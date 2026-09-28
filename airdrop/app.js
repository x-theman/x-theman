(() => {
  const cfg = window.AIRDROP_CONFIG;
  const { ethers } = window;

  // The only contract calls this site makes. No approvals, permits or transfers.
  const DISTRIBUTOR_ABI = [
    "function claim(address account, uint256 amount, bytes32[] proof)",
    "function isClaimed(address account) view returns (bool)",
  ];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const demoMode = !cfg.distributorAddress;
  let claimsData = null;
  let account = null;
  let currentClaim = null;

  // ---------- Branding ----------
  $$("[data-project-name]").forEach((el) => (el.textContent = cfg.projectName));
  $$("[data-token-symbol]").forEach((el) => (el.textContent = cfg.tokenSymbol));
  $$("[data-link]").forEach((el) => (el.href = cfg.links[el.dataset.link] || "#"));
  document.title = `${cfg.projectName} Airdrop`;

  // ---------- Helpers ----------
  const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

  function formatAmount(raw) {
    const n = Number(ethers.formatUnits(raw, cfg.tokenDecimals));
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function compact(raw) {
    const n = Number(ethers.formatUnits(raw, cfg.tokenDecimals));
    return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }

  function showState(name) {
    $$(".state").forEach((el) => (el.hidden = el.dataset.state !== name));
    const stepFor = { disconnected: 1, checking: 2, eligible: 3, ineligible: 2, claiming: 3, claimed: 4 };
    const active = stepFor[name];
    $$(".step").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("active", n === active);
      el.classList.toggle("done", n < active);
    });
    setError("");
  }

  function setError(msg) {
    const el = $("#errorMsg");
    el.textContent = msg;
    el.hidden = !msg;
  }

  function updateConnectButton() {
    const btn = $("#connectBtn");
    btn.textContent = account ? shortAddr(account) : "Connect wallet";
  }

  // ---------- Data ----------
  async function loadClaims() {
    if (claimsData) return claimsData;
    const res = await fetch(cfg.claimsUrl);
    if (!res.ok) throw new Error("Could not load the allocation list.");
    const data = await res.json();
    // Normalise keys so lookups are case-insensitive.
    const claims = {};
    for (const [addr, c] of Object.entries(data.claims)) claims[addr.toLowerCase()] = c;
    claimsData = { ...data, claims };
    return claimsData;
  }

  async function renderStats() {
    try {
      const data = await loadClaims();
      $("#statTotal").textContent = `${compact(data.tokenTotal)} ${cfg.tokenSymbol}`;
      $("#statWallets").textContent = Object.keys(data.claims).length.toLocaleString();
    } catch {
      /* stats are decorative; ignore failures */
    }
  }

  function startCountdown() {
    const end = new Date(cfg.claimDeadline).getTime();
    const el = $("#statCountdown");
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        el.textContent = "Closed";
        return;
      }
      const d = Math.floor(diff / 864e5);
      const h = Math.floor((diff % 864e5) / 36e5);
      const m = Math.floor((diff % 36e5) / 6e4);
      const s = Math.floor((diff % 6e4) / 1e3);
      el.textContent = `${d}d ${h}h ${m}m ${String(s).padStart(2, "0")}s`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Wallet ----------
  async function ensureChain() {
    const current = await window.ethereum.request({ method: "eth_chainId" });
    if (current.toLowerCase() === cfg.chainId.toLowerCase()) return;
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: cfg.chainId }],
    });
  }

  async function connect() {
    if (!window.ethereum) {
      setError("No wallet found. Install a browser wallet such as MetaMask or Rabby.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await onAccount(accounts[0]);
    } catch (err) {
      setError(err?.message || "Wallet connection was rejected.");
    }
  }

  function disconnect() {
    account = null;
    currentClaim = null;
    updateConnectButton();
    showState("disconnected");
  }

  async function onAccount(addr) {
    if (!addr) return disconnect();
    account = ethers.getAddress(addr);
    updateConnectButton();
    showState("checking");
    try {
      const data = await loadClaims();
      currentClaim = data.claims[account.toLowerCase()] || null;
      if (!currentClaim) {
        $("#ineligibleAddr").textContent = shortAddr(account);
        showState("ineligible");
        return;
      }
      if (!demoMode && (await alreadyClaimed(account))) {
        $("#claimedAmount").textContent = formatAmount(currentClaim.amount);
        $("#txLink").hidden = true;
        showState("claimed");
        return;
      }
      $("#amount").textContent = formatAmount(currentClaim.amount);
      $("#walletAddr").textContent = shortAddr(account);
      $("#demoNote").hidden = !demoMode;
      showState("eligible");
    } catch (err) {
      showState("disconnected");
      setError(err?.message || "Something went wrong while checking eligibility.");
    }
  }

  async function alreadyClaimed(addr) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(cfg.distributorAddress, DISTRIBUTOR_ABI, provider);
      return await contract.isClaimed(addr);
    } catch {
      return false;
    }
  }

  async function claim() {
    if (!account || !currentClaim) return;
    showState("claiming");

    if (demoMode) {
      await new Promise((r) => setTimeout(r, 1600));
      $("#claimedAmount").textContent = formatAmount(currentClaim.amount);
      $("#txLink").hidden = true;
      showState("claimed");
      return;
    }

    try {
      await ensureChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(cfg.distributorAddress, DISTRIBUTOR_ABI, signer);
      const tx = await contract.claim(account, currentClaim.amount, currentClaim.proof);
      await tx.wait();
      $("#claimedAmount").textContent = formatAmount(currentClaim.amount);
      const link = $("#txLink");
      link.href = `${cfg.explorerUrl}/tx/${tx.hash}`;
      link.hidden = false;
      showState("claimed");
    } catch (err) {
      showState("eligible");
      setError(err?.shortMessage || err?.message || "The claim transaction failed.");
    }
  }

  // ---------- Address lookup (no wallet needed) ----------
  async function lookup(e) {
    e.preventDefault();
    const out = $("#lookupResult");
    const value = $("#lookupInput").value.trim();
    out.hidden = false;
    out.className = "lookup-result";
    if (!ethers.isAddress(value)) {
      out.textContent = "That doesn't look like a valid address.";
      out.classList.add("bad");
      return;
    }
    try {
      const data = await loadClaims();
      const c = data.claims[value.toLowerCase()];
      if (c) {
        out.textContent = `Eligible for ${formatAmount(c.amount)} ${cfg.tokenSymbol}. Connect this wallet to claim.`;
        out.classList.add("ok");
      } else {
        out.textContent = "This address is not eligible.";
        out.classList.add("bad");
      }
    } catch (err) {
      out.textContent = err.message;
      out.classList.add("bad");
    }
  }

  // ---------- Wire up ----------
  $("#connectBtn").addEventListener("click", () => (account ? disconnect() : connect()));
  $$('[data-action="connect"]').forEach((b) => b.addEventListener("click", connect));
  $$('[data-action="disconnect"]').forEach((b) => b.addEventListener("click", disconnect));
  $$('[data-action="claim"]').forEach((b) => b.addEventListener("click", claim));
  $("#lookupForm").addEventListener("submit", lookup);

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", (accs) => onAccount(accs[0]));
    // Restore an existing connection without prompting.
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accs) => accs[0] && onAccount(accs[0]))
      .catch(() => {});
  }

  showState("disconnected");
  renderStats();
  startCountdown();
})();
