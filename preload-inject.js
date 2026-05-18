/**
 * preload-inject.js - PROTOCOLO DE AISLAMIENTO Y PARCHADO GENERAL
 */
(() => {
  try {
    // Generamos valores móviles basados en una semilla matemática fija de sesión para aislar el hardware real
    const hashSeed = window.location.host || "android_profile";
    const forcedCores = hashSeed.length % 2 === 0 ? 8 : 6;
    const forcedRam = hashSeed.length % 2 === 0 ? 12 : 8;
    const simulatedVendor = forcedCores === 8 ? 'Qualcomm' : 'ARM';
    const simulatedRenderer = forcedCores === 8 ? 'Adreno (TM) 740' : 'Mali-G715 Immortalis-MC11';

    // 1. REESCRITURA TOTAL DE PROPIEDADES DE SENSOR HARDWARE
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => forcedCores, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => forcedRam, configurable: true });
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l', configurable: true });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.', configurable: true });

    // 2. PARCHADO CRÍTICO DE WEBGL 1 Y WEBGL 2 (Destrucción del reporte Apple M4)
    const patchWebGL = (proto) => {
      if (!proto) return;
      const originalGetParameter = proto.getParameter;
      proto.getParameter = function(p) {
        if (p === 37445) return simulatedVendor;     // UNMASKED_VENDOR_WEBGL
        if (p === 37446) return simulatedRenderer;   // UNMASKED_RENDERER_WEBGL
        return originalGetParameter.apply(this, arguments);
      };
    };

    patchWebGL(WebGLRenderingContext.prototype);
    patchWebGL(WebGL2RenderingContext.prototype);

    // 3. ENVENENAMIENTO DE CANVAS MÓVIL
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
      const imageData = originalGetImageData.apply(this, arguments);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] > 0) { 
          data[i] = Math.min(255, Math.max(0, data[i] + (forcedCores === 8 ? 1 : -1)));
          data[i+2] = Math.min(255, Math.max(0, data[i+2] + (forcedCores === 8 ? -1 : 1)));
        }
      }
      return imageData;
    };

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function() {
      const ctx = this.getContext('2d');
      if (ctx) {
        ctx.fillStyle = `rgba(${forcedCores},0,0,0.01)`;
        ctx.fillRect(0, 0, 1, 1);
      }
      return originalToDataURL.apply(this, arguments);
    };

    // 4. EVASIÓN DEL PARCHE DE FUENTES NATIVAS
    if (document.fonts) {
      const originalMatch = window.matchMedia;
      window.matchMedia = function(query) {
        if (query.includes('font') || query.includes('Apple')) return { matches: false };
        return originalMatch.apply(this, arguments);
      };
    }

    console.log(`🛡️ [Inyección Síncrona] Perfil Asegurado como Android [GPU: ${simulatedRenderer}]`);

    Object.defineProperty(window, "__APP_PROFILE_PRELOAD_READY__", {
      value: true, writable: false, configurable: false, enumerable: false,
    });
  } catch (error) {
    console.error("[preload-inject] Error de ejecución en Preload:", error);
  }
})();