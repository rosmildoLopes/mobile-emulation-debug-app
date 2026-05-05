// Ruido en Canvas (Signature única)
const toBlob = HTMLCanvasElement.prototype.toBlob;
const toDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toBlob = function() {
  const ctx = this.getContext('2d');
  if (ctx) { ctx.fillStyle = 'rgba(255,255,255,0.01)'; ctx.fillRect(0, 0, 1, 1); }
  return toBlob.apply(this, arguments);
};
HTMLCanvasElement.prototype.toDataURL = function() {
  const ctx = this.getContext('2d');
  if (ctx) { ctx.fillStyle = 'rgba(255,255,255,0.01)'; ctx.fillRect(0, 0, 1, 1); }
  return toDataURL.apply(this, arguments);
};

// Emulación WebGL (GPU Adreno)
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(p) {
  if (p === 37445) return 'Qualcomm';
  if (p === 37446) return 'Adreno (TM) 740';
  return getParameter.apply(this, arguments);
};

// Emulación de Hardware
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

// Emulación de Batería
navigator.getBattery = () => Promise.resolve({
  charging: true, level: 0.85, chargingTime: 0, dischargingTime: Infinity, addEventListener: () => {}
});

console.log("✅ Stealth Injected: Pixel 8 Hardware Masking");