/**
 * js/seismic-laws.js
 * المحرك الرياضي والفيزيائي النقي لجميع القوانين الزلزالية (السنة الثالثة متوسط)
 * يتضمن حارس المدخلات الصارم (sanitizeSeismicParams) لمنع القسمة على صفر أو قيم NaN/Infinity.
 */

const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI',
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
];

const MERCALLI_DESCRIPTIONS_AR = [
  'I — غير محسوس (يسجله السيزموغراف فقط)',
  'II — ضعيف جداً (يشعر به قلة في الطوابق العليا)',
  'III — ضعيف (يشعر به داخل المباني كاهتزاز شاحنة)',
  'IV — معتدل (اهتزاز النوافذ والأبواب والأواني)',
  'V — قوي نسبياً (يستيقظ النائمون وتتأرجح الأجسام المعلقة)',
  'VI — قوي (شعور عام بالذعر وتشققات خفيفة في الجدران)',
  'VII — قوي جداً (تكسر المداخن وتضرر البنايات الهشة)',
  'VIII — مخرب (انهيار جزئي للبنايات العادية وشقوق أرضية)',
  'IX — مدمر (انهيار المباني غير المضادة للزلازل وانكسار القنوات)',
  'X — كاسح (تدمير معظم المباني، التواء السكك، وظهور فوالق)',
  'XI — كارثي (دمار شبه كلي للبنية التحتية والجسور)',
  'XII — كارثي شامل (تغير معالم سطح الأرض وانقلاب الطبقات)'
];

/**
 * دالة حصر القيمة الرقمية ضمن مجال آمن مع قيمة افتراضية عند الخطأ
 */
export function clampFinite(value, min, max, fallback) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

/**
 * حارس المدخلات الفيزيائية (Critic Invariant #1)
 * يضمن عدم حدوث NaN أو القسمة على صفر عندما v_P <= v_S
 */
export function sanitizeSeismicParams(raw = {}) {
  const vs = clampFinite(raw.vs ?? raw.vsKmS, 2.0, 5.0, 3.5);
  let vp = clampFinite(raw.vp ?? raw.vpKmS, 4.0, 8.5, 6.0);
  if (vp <= vs + 0.5) {
    vp = Number((vs + 0.5).toFixed(2));
  }

  const magnitude = clampFinite(raw.magnitude, 2.0, 9.5, 6.5);
  const depthKm = clampFinite(raw.depthKm ?? raw.depthH, 1.0, 300.0, 15.0);
  const stationDistKm = clampFinite(raw.stationDistKm ?? raw.distKm, 1.0, 2000.0, 80.0);
  const deltaT = clampFinite(raw.deltaT, 0.5, 300.0, 12.0);
  const amplitudeUm = clampFinite(raw.amplitudeUm, 0.1, 1e8, 1000.0);
  const mag1 = clampFinite(raw.mag1, 1.0, 9.5, 5.0);
  const mag2 = clampFinite(raw.mag2, 1.0, 9.5, 7.0);

  const validFaults = ['normal', 'reverse', 'strike-slip'];
  const faultType = validFaults.includes(raw.faultType) ? raw.faultType : 'reverse';

  return {
    vp,
    vs,
    magnitude,
    depthKm,
    stationDistKm,
    deltaT,
    amplitudeUm,
    mag1,
    mag2,
    faultType
  };
}

/**
 * تحويل شدة ميركالي العشرية إلى رقم روماني ووصف عربي
 */
export function toRomanIntensity(intensityValue) {
  const idx = Math.min(11, Math.max(0, Math.round(intensityValue) - 1));
  return {
    roman: ROMAN_NUMERALS[idx],
    descriptionAr: MERCALLI_DESCRIPTIONS_AR[idx]
  };
}

const SUPERSCRIPT_MAP = {
  '-': '⁻',
  '+': '⁺',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹'
};

function toSuperscriptDigits(val) {
  return String(val)
    .split('')
    .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
    .join('');
}

/**
 * تنسيق الأعداد العلمية الكبيرة بصيغة مقروءة (مثلاً 3.55 × 10¹⁴)
 */
export function formatScientificAr(num) {
  if (!Number.isFinite(num) || num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 0.01 && abs < 10000) {
    return num.toFixed(2);
  }
  const exp = Math.floor(Math.log10(abs));
  const mantissa = (num / Math.pow(10, exp)).toFixed(2);
  return `${mantissa} × 10${toSuperscriptDigits(exp)}`;
}

/**
 * تنسيق الأعداد العلمية الكبيرة بصيغة HTML نظيفة (مثلاً 3.55 × 10<sup>14</sup>)
 */
export function formatScientificHtml(num) {
  if (!Number.isFinite(num) || num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 0.01 && abs < 10000) {
    return num.toFixed(2);
  }
  const exp = Math.floor(Math.log10(abs));
  const mantissa = (num / Math.pow(10, exp)).toFixed(2);
  return `${mantissa} × 10<sup>${exp}</sup>`;
}

/**
 * 1 & 2. قانون المسافة البؤرية (d_hypo) والمسافة السطحية (x) من فارق الزمن (Δt)
 */
export function calculateDistanceFromDeltaT(deltaTInput, vpInput, vsInput, depthHInput) {
  const clean = sanitizeSeismicParams({
    deltaT: deltaTInput,
    vp: vpInput,
    vs: vsInput,
    depthH: depthHInput
  });

  const { deltaT, vp, vs, depthKm } = clean;
  const omoriFactor = (vp * vs) / (vp - vs);
  const hypocentralDistKm = deltaT * omoriFactor;
  const epicentralSq = Math.max(0, hypocentralDistKm * hypocentralDistKm - depthKm * depthKm);
  const epicentralDistKm = Math.sqrt(epicentralSq);

  const travelTimePSec = hypocentralDistKm / vp;
  const travelTimeSSec = hypocentralDistKm / vs;

  const stepsAr = [
    `1) حساب معامل السرعة (معامل أوموري): (vP × vS) / (vP − vS) = (${vp.toFixed(1)} × ${vs.toFixed(1)}) / (${vp.toFixed(1)} − ${vs.toFixed(1)}) = ${omoriFactor.toFixed(2)} km/s`,
    `2) حساب المسافة البؤرية (الشعاع الزلزالي d): d = Δt × ${omoriFactor.toFixed(2)} = ${deltaT.toFixed(1)} × ${omoriFactor.toFixed(2)} = ${hypocentralDistKm.toFixed(2)} km`,
    `3) تطبيق مبرهنة فيثاغورس في المثلث القائم (FES): x = √(d² − h²) = √(${hypocentralDistKm.toFixed(1)}² − ${depthKm.toFixed(1)}²) = ${epicentralDistKm.toFixed(2)} km`,
    `4) مدة انتشار الموجة الأولية P من البؤرة للمحطة: tP − t0 = d / vP = ${travelTimePSec.toFixed(2)} ثانية (ومدة الموجة S هي ${travelTimeSSec.toFixed(2)} ثانية).`
  ];

  const stepsHtml = [
    `<span class="math-step-label">1) حساب معامل السرعة (معامل أوموري):</span>
     <span class="math-inline" dir="ltr">
       <span class="math-frac"><span class="math-num"><var>v</var><sub>P</sub> × <var>v</var><sub>S</sub></span><span class="math-den"><var>v</var><sub>P</sub> − <var>v</var><sub>S</sub></span></span>
       =
       <span class="math-frac"><span class="math-num">${vp.toFixed(1)} × ${vs.toFixed(1)}</span><span class="math-den">${vp.toFixed(1)} − ${vs.toFixed(1)}</span></span>
       = <strong>${omoriFactor.toFixed(2)} <span class="math-unit">km/s</span></strong>
     </span>`,
    `<span class="math-step-label">2) حساب المسافة البؤرية (الشعاع الزلزالي <span class="math-inline" dir="ltr"><var>d</var><sub>hypo</sub></span>):</span>
     <span class="math-inline" dir="ltr">
       <var>d</var><sub>hypo</sub> = Δ<var>t</var> × ${omoriFactor.toFixed(2)} = ${deltaT.toFixed(1)} × ${omoriFactor.toFixed(2)} = <strong>${hypocentralDistKm.toFixed(2)} <span class="math-unit">km</span></strong>
     </span>`,
    `<span class="math-step-label">3) تطبيق مبرهنة فيثاغورس في المثلث القائم <span class="math-inline" dir="ltr">(<var>F</var><var>E</var><var>S</var>)</span>:</span>
     <span class="math-inline" dir="ltr">
       <var>x</var> =
       <span class="math-sqrt"><span class="math-sqrt-sign">√</span><span class="math-radicand"><var>d</var><sub>hypo</sub><sup>2</sup> − <var>h</var><sup>2</sup></span></span>
       =
       <span class="math-sqrt"><span class="math-sqrt-sign">√</span><span class="math-radicand">${hypocentralDistKm.toFixed(1)}<sup>2</sup> − ${depthKm.toFixed(1)}<sup>2</sup></span></span>
       = <strong>${epicentralDistKm.toFixed(2)} <span class="math-unit">km</span></strong>
     </span>`,
    `<span class="math-step-label">4) مدة انتشار الموجتين <span class="math-inline" dir="ltr"><var>P</var></span> و <span class="math-inline" dir="ltr"><var>S</var></span> من البؤرة للمحطة:</span>
     <span class="math-inline" dir="ltr">
       <var>t</var><sub>P</sub> − <var>t</var><sub>0</sub> = <span class="math-frac"><span class="math-num"><var>d</var><sub>hypo</sub></span><span class="math-den"><var>v</var><sub>P</sub></span></span> = <strong>${travelTimePSec.toFixed(2)} <span class="math-unit">s</span></strong>
     </span>
     ، ومدة الموجة <span class="math-inline" dir="ltr"><var>S</var></span>:
     <span class="math-inline" dir="ltr">
       <var>t</var><sub>S</sub> − <var>t</var><sub>0</sub> = <span class="math-frac"><span class="math-num"><var>d</var><sub>hypo</sub></span><span class="math-den"><var>v</var><sub>S</sub></span></span> = <strong>${travelTimeSSec.toFixed(2)} <span class="math-unit">s</span></strong>
     </span>`
  ];

  return {
    hypocentralDistKm,
    epicentralDistKm,
    omoriFactor,
    travelTimePSec,
    travelTimeSSec,
    stepsAr,
    stepsHtml
  };
}

/**
 * 3 & 4. قانون ريشتر للمقدار المحلي (ML) وقانون غوتنبرغ-ريشتر للطاقة الزلزالية (E)
 */
export function calculateRichterAndEnergy(amplitudeUmInput, distKmInput, mag1Input, mag2Input) {
  const clean = sanitizeSeismicParams({
    amplitudeUm: amplitudeUmInput,
    distKm: distKmInput,
    mag1: mag1Input,
    mag2: mag2Input
  });

  const { amplitudeUm, stationDistKm, mag1, mag2 } = clean;

  const localMagnitude = clampFinite(
    Math.log10(amplitudeUm) + 1.66 * Math.log10(stationDistKm) - 2.0,
    0.5,
    9.8,
    5.0
  );

  const energyJoules = Math.pow(10, 4.8 + 1.5 * localMagnitude);
  const tntTons = energyJoules / 4.184e9;

  const deltaM = mag2 - mag1;
  const amplitudeRatio = Math.pow(10, deltaM);
  const energyRatio = Math.pow(10, 1.5 * deltaM);

  const energy1Joules = Math.pow(10, 4.8 + 1.5 * mag1);
  const energy2Joules = Math.pow(10, 4.8 + 1.5 * mag2);

  const stepsAr = [
    `1) حساب المقدار المحلي على سلم ريشتر (ML): ML = log₁₀(${amplitudeUm}) + 1.66 × log₁₀(${stationDistKm}) − 2.0 = ${localMagnitude.toFixed(2)} درجة.`,
    `2) حساب الطاقة المحررة للمقدار ML حسب غوتنبرغ-ريشتر: E = 10^(4.8 + 1.5 × ${localMagnitude.toFixed(2)}) = ${formatScientificAr(energyJoules)} جول (ما يعادل ${formatScientificAr(tntTons)} طن من الـ TNT).`,
    `3) مقارنة الزلزالين (M₁ = ${mag1.toFixed(1)} و M₂ = ${mag2.toFixed(1)}، فرق المقدار ΔM = ${deltaM.toFixed(1)}):`,
    `   • نسبة تضاعف سعة الهزة: A₂ / A₁ = 10^(${deltaM.toFixed(1)}) = ${formatScientificAr(amplitudeRatio)} مرة.`,
    `   • نسبة تضاعف الطاقة المحررة: E₂ / E₁ = 10^(1.5 × ${deltaM.toFixed(1)}) = ${formatScientificAr(energyRatio)} مرة.`
  ];

  const stepsHtml = [
    `<span class="math-step-label">1) حساب المقدار المحلي على سلم ريشتر (<span class="math-inline" dir="ltr"><var>M</var><sub>L</sub></span>):</span>
     <span class="math-inline" dir="ltr">
       <var>M</var><sub>L</sub> = log<sub>10</sub>(${amplitudeUm}) + 1.66 · log<sub>10</sub>(${stationDistKm}) − 2.0 = <strong>${localMagnitude.toFixed(2)}</strong>
     </span> درجة.`,
    `<span class="math-step-label">2) حساب الطاقة المحررة (<span class="math-inline" dir="ltr"><var>E</var></span>) حسب علاقة غوتنبرغ-ريشتر:</span>
     <span class="math-inline" dir="ltr">
       <var>E</var> = 10<sup>(4.8 + 1.5 × ${localMagnitude.toFixed(2)})</sup> = <strong>${formatScientificHtml(energyJoules)} <span class="math-unit">J</span></strong>
     </span>
     (ما يعادل <span class="math-inline" dir="ltr">${formatScientificHtml(tntTons)} <span class="math-unit">Tons TNT</span></span>).`,
    `<span class="math-step-label">3) مقارنة الزلزالين (<span class="math-inline" dir="ltr"><var>M</var><sub>1</sub> = ${mag1.toFixed(1)}</span> و <span class="math-inline" dir="ltr"><var>M</var><sub>2</sub> = ${mag2.toFixed(1)}</span>، فرق المقدار <span class="math-inline" dir="ltr">Δ<var>M</var> = ${deltaM.toFixed(1)}</span>):</span>`,
    `<span class="math-step-label">• نسبة تضاعف سعة الهزة:</span>
     <span class="math-inline" dir="ltr">
       <span class="math-frac"><span class="math-num"><var>A</var><sub>2</sub></span><span class="math-den"><var>A</var><sub>1</sub></span></span>
       = 10<sup>(${deltaM.toFixed(1)})</sup> = <strong>${formatScientificHtml(amplitudeRatio)}</strong>
     </span> مرة.`,
    `<span class="math-step-label">• نسبة تضاعف الطاقة المحررة:</span>
     <span class="math-inline" dir="ltr">
       <span class="math-frac"><span class="math-num"><var>E</var><sub>2</sub></span><span class="math-den"><var>E</var><sub>1</sub></span></span>
       = 10<sup>(1.5 × ${deltaM.toFixed(1)})</sup> = <strong>${formatScientificHtml(energyRatio)}</strong>
     </span> مرة.`
  ];

  return {
    localMagnitude,
    energyJoules,
    tntTons,
    amplitudeRatio,
    energyRatio,
    energy1Joules,
    energy2Joules,
    stepsAr,
    stepsHtml
  };
}

/**
 * 5. قانون العزم الزلزالي (M0) ومقدار العزم (Mw)
 */
export function calculateSeismicMoment(muPa = 3.0e10, areaM2 = 5.0e7, slipM = 1.5) {
  const mu = clampFinite(muPa, 1e9, 1e12, 3.0e10);
  const area = clampFinite(areaM2, 1e3, 1e12, 5.0e7);
  const slip = clampFinite(slipM, 0.01, 50.0, 1.5);

  const momentNm = mu * area * slip;
  const momentMagnitudeMw = (2 / 3) * Math.log10(momentNm) - 6.07;

  return {
    momentNm,
    momentMagnitudeMw: clampFinite(momentMagnitudeMw, 1.0, 9.8, 6.0)
  };
}

/**
 * 6. قانون الشدة الزلزالية في المركز السطحي (I0) وتخامدها مع العمق والمسافة I(x)
 */
export function calculateIntensityProfile(magnitudeInput, depthKmInput, surfaceDistKmInput) {
  const clean = sanitizeSeismicParams({
    magnitude: magnitudeInput,
    depthKm: depthKmInput,
    stationDistKm: surfaceDistKmInput
  });

  const { magnitude, depthKm, stationDistKm } = clean;
  const effectiveDepth = Math.max(1.0, depthKm);

  const rawI0 = 1.5 * magnitude - 3.5 * Math.log10(effectiveDepth) + 3.0;
  const epicentralIntensity = clampFinite(rawI0, 1.0, 12.0, 6.0);

  const hypoDist = Math.sqrt(stationDistKm * stationDistKm + effectiveDepth * effectiveDepth);
  const rawIx =
    epicentralIntensity -
    3.0 * Math.log10(hypoDist / effectiveDepth) -
    0.002 * (hypoDist - effectiveDepth);
  const stationIntensity = clampFinite(rawIx, 1.0, epicentralIntensity, 3.0);

  const i0Meta = toRomanIntensity(epicentralIntensity);
  const ixMeta = toRomanIntensity(stationIntensity);

  return {
    epicentralIntensity,
    stationIntensity,
    hypoDistKm: hypoDist,
    romanI0: i0Meta.roman,
    romanIx: ixMeta.roman,
    mercalliDescriptionAr: i0Meta.descriptionAr,
    stationDescriptionAr: ixMeta.descriptionAr
  };
}

/**
 * 7. قانون التثليث الزلزالي لتحديد المركز السطحي من 3 محطات رصد
 */
export function solveTriangulation(
  stations = [
    { id: 'S1', nameAr: 'محطة الجزائر العاصمة (S1)', x: 290, y: 95 },
    { id: 'S2', nameAr: 'محطة وهران (S2)', x: 115, y: 155 },
    { id: 'S3', nameAr: 'محطة قسنطينة (S3)', x: 465, y: 125 }
  ],
  deltaTs = [10.0, 14.5, 11.5],
  vp = 6.0,
  vs = 3.5,
  depthH = 15.0
) {
  const dt1 = clampFinite(deltaTs[0], 1.5, 60.0, 10.0);
  const dt2 = clampFinite(deltaTs[1], 1.5, 60.0, 14.5);
  const dt3 = clampFinite(deltaTs[2], 1.5, 60.0, 11.5);

  const d1 = calculateDistanceFromDeltaT(dt1, vp, vs, depthH).epicentralDistKm;
  const d2 = calculateDistanceFromDeltaT(dt2, vp, vs, depthH).epicentralDistKm;
  const d3 = calculateDistanceFromDeltaT(dt3, vp, vs, depthH).epicentralDistKm;

  // معامل تحويل الكيلومتر إلى إحداثيات الخريطة الشعاعية (1 km = 1.15 px)
  const scalePxPerKm = 1.15;
  const r1 = Math.max(15, d1 * scalePxPerKm);
  const r2 = Math.max(15, d2 * scalePxPerKm);
  const r3 = Math.max(15, d3 * scalePxPerKm);

  const s1 = stations[0];
  const s2 = stations[1];
  const s3 = stations[2];

  // حل جملة المحاور الأساسية للدوائر الثلاث (Radical Axis Intersection)
  const A = 2 * (s2.x - s1.x);
  const B = 2 * (s2.y - s1.y);
  const C = r1 * r1 - r2 * r2 - s1.x * s1.x + s2.x * s2.x - s1.y * s1.y + s2.y * s2.y;

  const D = 2 * (s3.x - s2.x);
  const E = 2 * (s3.y - s2.y);
  const F = r2 * r2 - r3 * r3 - s2.x * s2.x + s3.x * s3.x - s2.y * s2.y + s3.y * s3.y;

  const det = A * E - B * D;
  let ex;
  let ey;

  if (Math.abs(det) > 1e-5) {
    ex = (C * E - B * F) / det;
    ey = (A * F - C * D) / det;
  } else {
    // حارس الاستقامية (Collinearity Fallback): مرجح عكسياً مع المسافات
    const w1 = 1 / Math.max(1, d1);
    const w2 = 1 / Math.max(1, d2);
    const w3 = 1 / Math.max(1, d3);
    const wSum = w1 + w2 + w3;
    ex = (s1.x * w1 + s2.x * w2 + s3.x * w3) / wSum;
    ey = (s1.y * w1 + s2.y * w2 + s3.y * w3) / wSum;
  }

  // حصر إحداثيات المركز السطحي داخل حدود الخريطة
  const clampedEx = clampFinite(ex, 60, 560, 290);
  const clampedEy = clampFinite(ey, 50, 270, 140);

  return {
    stations: [
      { ...s1, deltaT: dt1, distKm: d1, radiusPx: r1 },
      { ...s2, deltaT: dt2, distKm: d2, radiusPx: r2 },
      { ...s3, deltaT: dt3, distKm: d3, radiusPx: r3 }
    ],
    epicenter: {
      x: clampedEx,
      y: clampedEy,
      latDeg: Number((36.95 - (clampedEy - 85) * 0.015).toFixed(2)),
      lonDeg: Number((3.05 + (clampedEx - 290) * 0.018).toFixed(2))
    }
  };
}
