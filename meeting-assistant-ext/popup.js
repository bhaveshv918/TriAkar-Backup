const keyInput = document.getElementById('keyInput');
const saveBtn  = document.getElementById('saveBtn');
const savedMsg = document.getElementById('savedMsg');

chrome.storage.sync.get('ma_api_key', (d) => {
  if (d.ma_api_key) keyInput.value = d.ma_api_key;
});

saveBtn.addEventListener('click', save);
keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

function save() {
  const key = keyInput.value.trim();
  if (!key) return;
  chrome.storage.sync.set({ ma_api_key: key }, () => {
    savedMsg.style.display = 'block';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 3000);
  });
}
