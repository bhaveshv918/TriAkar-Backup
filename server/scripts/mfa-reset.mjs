/* ══════════════ BREAK GLASS: reset admin two-factor ══════════════

   Run this when the authenticator app is gone and nobody can produce a 6-digit
   code any more. It deletes the TOTP factors on an account, which drops that
   account back to password-only sign-in.

   Usage, from the `server` folder:

     node --env-file=.env scripts/mfa-reset.mjs --list
     node --env-file=.env scripts/mfa-reset.mjs
     node --env-file=.env scripts/mfa-reset.mjs someone@else.com --yes

   With no email it uses the first address in ADMIN_EMAILS. --list only prints
   what is enrolled and changes nothing, always worth running first. Without
   --yes it asks before deleting.

   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, which is the whole point:
   the service role is the escape hatch that sits underneath the second factor,
   so losing a phone is an inconvenience and not a lockout.

   What happens after it runs:
     - server/middleware/requireAdmin.js finds no verified factor and stops
       requiring aal2, so the next password login gets straight in. If it is
       still refusing, give it 60 seconds, that middleware caches the factor
       lookup for a minute in its fallback path.
     - js/admin-mfa.js sees nothing enrolled and stops prompting.
     - Supabase signs out the account's existing sessions when a verified
       factor is deleted, so expect to log in again everywhere.
     - Nothing else moves. The email allowlist, RLS, the password, passkeys and
       the whole customer-facing site are untouched.

   Then turn 2FA back on from admin Settings, and this time keep the secret
   somewhere offline. See DEPLOYMENT.md, Common Issues. */

import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';

const args    = process.argv.slice(2);
const flags   = new Set(args.filter(a => a.startsWith('--')));
const emailIn = args.find(a => !a.startsWith('--'));
const LIST_ONLY = flags.has('--list');
const ASSUME_YES = flags.has('--yes');

const email = (emailIn || (process.env.ADMIN_EMAILS || 'bhaveshv918@gmail.com').split(',')[0]).trim().toLowerCase();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run this from the server folder with: node --env-file=.env scripts/mfa-reset.mjs');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* Reads auth.users directly rather than looking the id up in `profiles` first.
   The owner account has no profiles row at all, so that shortcut would have been
   dead weight in exactly the situation this script exists for. A full scan takes
   about a second at this user count. */
async function findUser() {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error('listUsers failed: ' + error.message);
    const hit = (data?.users || []).find(u => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function listFactors(userId) {
  const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error('listFactors failed: ' + error.message);
  return Array.isArray(data) ? data : (data?.factors || []);
}

async function confirm(question) {
  if (ASSUME_YES) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim().toLowerCase() === 'yes';
}

/* Everything below sets process.exitCode and returns rather than calling
   process.exit(). Node on Windows trips a libuv assertion if it is torn down
   while the Supabase fetch keep-alive socket is still closing, which turned a
   clean "no account found" into a crash and an exit code of 127. */
async function main() {
  const user = await findUser();
  if (!user) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Account : ${user.email}`);
  console.log(`User ID : ${user.id}`);

  const factors = await listFactors(user.id);
  if (!factors.length) {
    console.log('\nNo MFA factors enrolled. Nothing to reset, this account already signs in with a password alone.');
    return;
  }

  console.log(`\n${factors.length} factor(s) enrolled:`);
  for (const f of factors) {
    console.log(`  ${f.id}  ${String(f.factor_type || '?').padEnd(8)} ${String(f.status || '?').padEnd(10)} ${f.friendly_name || '(no name)'}  enrolled ${f.created_at || '?'}`);
  }

  if (LIST_ONLY) {
    console.log('\n--list given, nothing was deleted.');
    return;
  }

  console.log('\nDeleting these drops the account back to password-only sign-in.');
  if (!await confirm('Type yes to delete them: ')) {
    console.log('Cancelled, nothing was deleted.');
    return;
  }

  let deleted = 0;
  for (const f of factors) {
    const { error } = await supabase.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
    if (error) console.error(`  failed ${f.id}: ${error.message}`);
    else { deleted++; console.log(`  deleted ${f.id}`); }
  }

  const left = await listFactors(user.id);
  console.log(`\nDeleted ${deleted} of ${factors.length}. ${left.length} factor(s) remaining.`);
  if (left.length) {
    console.error('Some factors survived. Fall back to the Supabase SQL Editor:');
    console.error(`  delete from auth.mfa_factors where user_id = '${user.id}';`);
    process.exitCode = 1;
    return;
  }
  console.log('Two-factor is off. Sign in with the password, then turn it back on from admin Settings');
  console.log('and save the secret key offline this time.');
}

await main();
