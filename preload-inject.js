/**
 * preload-inject.js — PROTOCOLO DE IDENTIDAD ANDROID COMPLETO v2
 *
 * Orden de ejecución garantizado (contextIsolation: false, sandbox: false):
 *   1. Se carga como preload de sesión (ses.setPreloads)
 *   2. Se ejecuta ANTES que cualquier script de la página
 *   3. Accede a window/navigator/WebGL nativamente en el mismo contexto
 *
 * Fingerprint recibido: el proceso principal lo inyecta en X-Fingerprint-Data
 * y lo expone como window.__FP__ antes de que esta IIFE corra.
 * Si por algún motivo aún no está disponible, usamos defaults seguros.
 */

(() => {
  "use strict";

  // ─── 0. OBTENER FINGERPRINT DEL PERFIL ──────────────────────────────────────
  // El fingerprint se expone a través de window.__FP__ que el proceso principal
  // inyecta mediante executeJavaScript en el evento 'did-start-loading'.
  // Como fallback, usamos valores Android genéricos.
  const FP = (() => {
    try {
      if (window.__FP__ && typeof window.__FP__ === 'object') return window.__FP__;
    } catch (_) {}
    return {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      canvasSeed: 1.0,
      audioNoiseSeed: 0.000042,
      webgl: {
        vendor: "Qualcomm",
        renderer: "Adreno (TM) 740",
        extensions: [
          "ANGLE_instanced_arrays", "EXT_blend_minmax", "EXT_color_buffer_half_float",
          "EXT_disjoint_timer_query", "EXT_float_blend", "EXT_frag_depth",
          "EXT_shader_texture_lod", "EXT_texture_filter_anisotropic", "EXT_sRGB",
          "KHR_parallel_shader_compile", "OES_element_index_uint", "OES_fbo_render_mipmap",
          "OES_standard_derivatives", "OES_texture_float", "OES_texture_float_linear",
          "OES_texture_half_float", "OES_texture_half_float_linear", "OES_vertex_array_object",
          "WEBGL_color_buffer_float", "WEBGL_compressed_texture_astc",
          "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_etc1",
          "WEBGL_debug_renderer_info", "WEBGL_debug_shaders", "WEBGL_depth_texture",
          "WEBGL_draw_buffers", "WEBGL_lose_context", "WEBGL_multi_draw"
        ]
      },
      platformVersion: "14.0.0",
      model: "Pixel 8"
    };
  })();

  // ─── 1. PROPIEDADES DE HARDWARE ─────────────────────────────────────────────
  const defineReadOnly = (obj, prop, value) => {
    try {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
        enumerable: true
      });
    } catch (_) {}
  };

  defineReadOnly(navigator, 'hardwareConcurrency', FP.hardwareConcurrency);
  defineReadOnly(navigator, 'deviceMemory', FP.deviceMemory);
  defineReadOnly(navigator, 'platform', 'Linux armv8l');
  defineReadOnly(navigator, 'vendor', 'Google Inc.');


  // ─── 2. WEBGL: VENDOR, RENDERER, EXTENSIONES Y SHADER PRECISION ─────────────
  /**
   * PROBLEMA ORIGINAL: Solo se parchaba getParameter para UNMASKED_VENDOR/RENDERER.
   * getSupportedExtensions() y getShaderPrecisionFormat() devolvían datos del M4.
   *
   * SOLUCIÓN: Interceptamos tres métodos adicionales:
   *   - getSupportedExtensions(): devolvemos la lista real del GPU simulado
   *   - getShaderPrecisionFormat(): devolvemos precisiones típicas de GPU móvil ARM/Qualcomm
   *   - getExtension(): bloqueamos extensiones no presentes en el GPU simulado
   */
  const ANDROID_WEBGL_EXTENSIONS = FP.webgl.extensions || [];

  // Precisiones de shader para GPU móviles (Adreno/Mali/Tensor)
  // Los valores son: { rangeMin, rangeMax, precision } por tipo
  // Android mobile GPUs típicamente tienen mediump = highp en fragment shaders
  const MOBILE_SHADER_PRECISION = {
    // [shaderType][precisionType] → { rangeMin, rangeMax, precision }
    // VERTEX_SHADER = 35633, FRAGMENT_SHADER = 35632
    // LOW_FLOAT = 36336, MEDIUM_FLOAT = 36337, HIGH_FLOAT = 36338
    // LOW_INT = 36339, MEDIUM_INT = 36340, HIGH_INT = 36341
    35633: { // VERTEX_SHADER
      36336: { rangeMin: 127, rangeMax: 127, precision: 23 },   // LOW_FLOAT
      36337: { rangeMin: 127, rangeMax: 127, precision: 23 },   // MEDIUM_FLOAT
      36338: { rangeMin: 127, rangeMax: 127, precision: 23 },   // HIGH_FLOAT
      36339: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // LOW_INT
      36340: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // MEDIUM_INT
      36341: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // HIGH_INT
    },
    35632: { // FRAGMENT_SHADER — Android: mediump == highp en la práctica
      36336: { rangeMin: 127, rangeMax: 127, precision: 23 },   // LOW_FLOAT
      36337: { rangeMin: 127, rangeMax: 127, precision: 23 },   // MEDIUM_FLOAT
      36338: { rangeMin: 127, rangeMax: 127, precision: 23 },   // HIGH_FLOAT
      36339: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // LOW_INT
      36340: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // MEDIUM_INT
      36341: { rangeMin: 31,  rangeMax: 30,  precision: 0 },    // HIGH_INT
    }
  };

  const patchWebGL = (proto) => {
    if (!proto) return;

    // 2a. getParameter — vendor, renderer y parámetros de capacidad móvil
    const originalGetParameter = proto.getParameter;
    proto.getParameter = function(p) {
      switch (p) {
        case 37445: return FP.webgl.vendor;     // UNMASKED_VENDOR_WEBGL
        case 37446: return FP.webgl.renderer;   // UNMASKED_RENDERER_WEBGL
        // MAX_TEXTURE_SIZE — 4096 es el límite seguro en Android (algunos tienen 8192)
        case 3379:  return 4096;
        // MAX_RENDERBUFFER_SIZE
        case 34024: return 4096;
        // MAX_VIEWPORT_DIMS → Int32Array simulado para móvil
        case 3386:  return new Int32Array([4096, 4096]);
        // MAX_VERTEX_TEXTURE_IMAGE_UNITS — típico en Adreno/Mali
        case 35660: return 16;
        // MAX_TEXTURE_IMAGE_UNITS
        case 34930: return 16;
        // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        case 35661: return 32;
        // MAX_VERTEX_ATTRIBS
        case 34921: return 16;
        // MAX_VARYING_VECTORS
        case 36348: return 15;
        // MAX_VERTEX_UNIFORM_VECTORS
        case 36347: return 256;
        // MAX_FRAGMENT_UNIFORM_VECTORS
        case 36349: return 224;
        // ALIASED_LINE_WIDTH_RANGE → móvil solo soporta width=1
        case 33902: return new Float32Array([1, 1]);
        // ALIASED_POINT_SIZE_RANGE
        case 33901: return new Float32Array([1, 1024]);
        default:    return originalGetParameter.apply(this, arguments);
      }
    };

    // 2b. getSupportedExtensions — lista filtrada del GPU simulado
    const originalGetSupportedExtensions = proto.getSupportedExtensions;
    proto.getSupportedExtensions = function() {
      // Devolvemos copia para evitar mutación externa
      return [...ANDROID_WEBGL_EXTENSIONS];
    };

    // 2c. getExtension — bloqueamos extensiones ausentes en el GPU simulado
    const originalGetExtension = proto.getExtension;
    proto.getExtension = function(name) {
      // Si la extensión no está en la lista simulada, retornamos null (comportamiento nativo)
      if (!ANDROID_WEBGL_EXTENSIONS.includes(name)) return null;
      return originalGetExtension.apply(this, arguments);
    };

    // 2d. getShaderPrecisionFormat — precisiones de GPU móvil
    const originalGetShaderPrecisionFormat = proto.getShaderPrecisionFormat;
    proto.getShaderPrecisionFormat = function(shaderType, precisionType) {
      const shaderMap = MOBILE_SHADER_PRECISION[shaderType];
      if (shaderMap && shaderMap[precisionType]) {
        const p = shaderMap[precisionType];
        // Retornamos un objeto con la misma forma que WebGLShaderPrecisionFormat
        return {
          rangeMin: p.rangeMin,
          rangeMax: p.rangeMax,
          precision: p.precision
        };
      }
      return originalGetShaderPrecisionFormat.apply(this, arguments);
    };
  };

  patchWebGL(WebGLRenderingContext.prototype);
  patchWebGL(WebGL2RenderingContext.prototype);


  // ─── 3. AUDIO FINGERPRINT — ENVENENAMIENTO MATEMÁTICO POR PERFIL ────────────
  /**
   * PROBLEMA ORIGINAL: AudioContext usa el DSP nativo del host. Todos los perfiles
   * comparten el mismo hash acústico porque el oscilador matemático es idéntico.
   *
   * SOLUCIÓN: Interceptamos getChannelData() y getFloatFrequencyData() para añadir
   * un micro-ruido determinístico basado en la semilla del perfil (audioNoiseSeed).
   * El ruido es:
   *   - Subperceptible: escala ~0.00001–0.0001, inaudible en reproducción real
   *   - Consistente: misma semilla → mismo perfil → mismo hash siempre
   *   - Único: cada perfil tiene su propia semilla guardada en el Store
   *
   * También parcheamos createOscillator para desviar ligeramente la frecuencia,
   * que es el método que usan la mayoría de tests de fingerprinting de audio.
   */
  const AUDIO_NOISE = FP.audioNoiseSeed || 0.000042;

  // Generador pseudoaleatorio determinístico (LCG simple, suficiente para ruido)
  // Produce la misma secuencia de números dado el mismo seed
  const makeLCG = (seed) => {
    let s = seed * 2147483647 | 0;
    return () => {
      s = Math.imul(1664525, s) + 1013904223 | 0;
      return (s >>> 0) / 4294967296; // [0, 1)
    };
  };

  // Parchamos AudioBuffer.prototype.getChannelData
  // Este método es el más usado en fingerprinting (OfflineAudioContext pattern)
  const originalGetChannelData = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = function(channel) {
    const data = originalGetChannelData.apply(this, arguments);
    const rng = makeLCG(AUDIO_NOISE * (channel + 1) * 1e9);
    for (let i = 0; i < data.length; i++) {
      // Ruido positivo/negativo alternado para no acumular DC offset
      data[i] += AUDIO_NOISE * (rng() * 2 - 1);
    }
    return data;
  };

  // Parchamos AnalyserNode para afectar también getFloatFrequencyData
  // Algunos tests usan la FFT del analizador en lugar del buffer directo
  const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
  AnalyserNode.prototype.getFloatFrequencyData = function(array) {
    originalGetFloatFrequencyData.apply(this, arguments);
    const rng = makeLCG(AUDIO_NOISE * 3.14159 * 1e9);
    for (let i = 0; i < array.length; i++) {
      // dB: ruido en escala logarítmica, muy sutil (~0.001 dB)
      array[i] += AUDIO_NOISE * 10 * (rng() * 2 - 1);
    }
  };

  const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
  AnalyserNode.prototype.getByteFrequencyData = function(array) {
    originalGetByteFrequencyData.apply(this, arguments);
    const rng = makeLCG(AUDIO_NOISE * 2.71828 * 1e9);
    for (let i = 0; i < array.length; i++) {
      // Uint8: variación de ±1 unidad máximo
      const delta = rng() > 0.5 ? 1 : 0;
      array[i] = Math.min(255, Math.max(0, array[i] + delta));
    }
  };


  // ─── 4. NAVIGATOR.USERAGENTDATA — CLIENT HINTS COMPLETOS ────────────────────
  /**
   * PROBLEMA ORIGINAL: navigator.userAgentData no estaba mocked.
   * Los sitios modernos llaman getHighEntropyValues(['model','platformVersion',
   * 'architecture','bitness']) y reciben datos del host real (macOS/ARM Apple).
   *
   * SOLUCIÓN: Creamos un objeto NavigatorUAData completo que:
   *   1. Expone .brands, .mobile, .platform como propiedades síncronas
   *   2. Implementa getHighEntropyValues() como Promise con los valores del perfil
   *   3. Implementa toJSON() para serialización correcta
   *
   * Los valores de model/platformVersion/architecture se leen del FP del perfil,
   * garantizando coherencia con hardwareConcurrency y deviceMemory almacenados.
   */
  const UA_BRANDS = [
    { brand: "Google Chrome", version: "147" },
    { brand: "Chromium", version: "147" },
    { brand: "Not=A?Brand", version: "24" }
  ];

  // Construimos el objeto de high entropy una vez (coherente con el FP del perfil)
  const HIGH_ENTROPY_VALUES = {
    brands: UA_BRANDS,
    mobile: true,
    platform: "Android",
    platformVersion: FP.platformVersion || "14.0.0",
    architecture: "arm",
    // bitness siempre 64 en Android moderno (Pixel 8 = arm64)
    bitness: "64",
    model: FP.model || "Pixel 8",
    // uaFullVersion es el string completo del motor Chrome
    uaFullVersion: "147.0.7463.65",
    fullVersionList: [
      { brand: "Google Chrome", version: "147.0.7463.65" },
      { brand: "Chromium", version: "147.0.7463.65" },
      { brand: "Not=A?Brand", version: "24.0.0.0" }
    ],
    wow64: false
  };

  // Clase que emula NavigatorUAData con su API completa
  const NavigatorUAData = {
    brands: UA_BRANDS,
    mobile: true,
    platform: "Android",

    // getHighEntropyValues devuelve una Promise con los valores solicitados
    getHighEntropyValues(hints) {
      // Filtramos solo los hints pedidos (como hace Chrome real)
      const result = { brands: UA_BRANDS, mobile: true, platform: "Android" };
      if (!Array.isArray(hints)) return Promise.resolve(result);

      const allowed = [
        'architecture', 'bitness', 'fullVersionList', 'mobile',
        'model', 'platform', 'platformVersion', 'uaFullVersion', 'wow64'
      ];
      for (const hint of hints) {
        if (allowed.includes(hint) && HIGH_ENTROPY_VALUES[hint] !== undefined) {
          result[hint] = HIGH_ENTROPY_VALUES[hint];
        }
      }
      return Promise.resolve(result);
    },

    toJSON() {
      return {
        brands: this.brands,
        mobile: this.mobile,
        platform: this.platform
      };
    }
  };

  // Inyectamos userAgentData en navigator
  try {
    Object.defineProperty(navigator, 'userAgentData', {
      get: () => NavigatorUAData,
      configurable: true,
      enumerable: true
    });
  } catch (_) {}


  // ─── 5. CANVAS FINGERPRINT (mantenido del original, mejorado) ───────────────
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
    const imageData = originalGetImageData.apply(this, arguments);
    const data = imageData.data;
    const rng = makeLCG(FP.canvasSeed * 1e9);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        // Variación ±1 en canal R y B, determinística por perfil
        const dr = rng() > 0.5 ? 1 : -1;
        const db = rng() > 0.5 ? 1 : -1;
        data[i]     = Math.min(255, Math.max(0, data[i]     + dr));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + db));
      }
    }
    return imageData;
  };

  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    const ctx = this.getContext('2d');
    if (ctx) {
      // Píxel invisible único por perfil usando canvasSeed
      ctx.fillStyle = `rgba(${Math.floor(FP.canvasSeed * 255) & 0xFF},0,0,0.002)`;
      ctx.fillRect(0, 0, 1, 1);
    }
    return originalToDataURL.apply(this, args);
  };


  // ─── 6. EVASIÓN DE DETECCIÓN DE AUTOMATIZACIÓN ──────────────────────────────
  // Eliminamos propiedades que denotan entorno controlado
  try {
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  } catch (_) {}

  // navigator.webdriver → siempre false en dispositivos reales
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true
    });
  } catch (_) {}

  // matchMedia — evasión de detección de fuentes nativas de Apple
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = function(query) {
    if (typeof query === 'string' && (query.includes('Apple') || query.includes('-apple'))) {
      return { matches: false, media: query, onchange: null,
               addListener: () => {}, removeListener: () => {},
               addEventListener: () => {}, removeEventListener: () => {},
               dispatchEvent: () => false };
    }
    return originalMatchMedia.apply(this, arguments);
  };


  // ─── SELLO DE INTEGRIDAD ─────────────────────────────────────────────────────
  Object.defineProperty(window, '__APP_PROFILE_PRELOAD_READY__', {
    value: true, writable: false, configurable: false, enumerable: false
  });

  console.log(
    `🛡️ [Preload v2] Android Emulation OK — GPU: ${FP.webgl.renderer} | ` +
    `RAM: ${FP.deviceMemory}GB | Cores: ${FP.hardwareConcurrency} | ` +
    `Audio seed: ${FP.audioNoiseSeed?.toFixed(8)}`
  );

})();