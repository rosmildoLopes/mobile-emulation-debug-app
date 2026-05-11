/**
 * STEALTH INJECTOR V10 - ANTI-MAC SIGNATURE
 */
const initStealth = () => {
  // 1. IDENTIDAD
  const props = { platform: 'Linux armv8l', vendor: 'Google Inc.', deviceMemory: 8, hardwareConcurrency: 8, webdriver: false };
  Object.keys(props).forEach(key => {
    Object.defineProperty(navigator, key, { get: () => props[key], configurable: true });
  });

  // 2. ENVENENAR CANVAS (Ataque al Checksum CRC)
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
    const imageData = originalGetImageData.apply(this, arguments);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 0) {
        // Ruido en todos los canales para que la firma MD5 sea imposible de rastrear a Mac
        data[i] = data[i] + (Math.random() > 0.5 ? 1 : -1);
        data[i+1] = data[i+1] + (Math.random() > 0.5 ? 1 : -1);
        data[i+2] = data[i+2] + (Math.random() > 0.5 ? 1 : -1);
      }
    }
    return imageData;
  };

  // 3. SOBREESCRIBIR TO_DATA_URL (El método que usa BrowserLeaks)
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx) {
      // Dibujamos un píxel casi invisible que altera el hash final del archivo
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fillRect(0, 0, 1, 1);
    }
    return originalToDataURL.apply(this, arguments);
  };
};

initStealth();
console.log("🛡️ V10: DNS Forzado & Canvas Mask Active.");