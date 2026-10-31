/**
 * js/app.js
 * المتحكم الرئيسي للتطبيق (Main Controller)
 * يربط المخزن النقي (State Store)، محاكي الموجات (Canvas)، المخططات الشعاعية (SVG)،
 * الحاسبات الزلزالية، الاختبار التفاعلي (8 أسئلة)، ومحرك الطباعة والتصدير إلى PDF.
 */

import {
  calculateDistanceFromDeltaT,
  calculateRichterAndEnergy,
  calculateIntensityProfile,
  solveTriangulation,
  formatScientificAr
} from './seismic-laws.js';

import {
  createStore,
  reduceAppState,
  SafeAudioSynthesizer
} from './state-machine.js';

import {
  renderAnatomyDiagramSVG,
  renderIsoseismalDiagramSVG,
  renderWavesAndFaultsDiagramSVG,
  renderTriangulationSVG
} from './svg-diagrams.js';

import { WaveCanvasSimulator } from './wave-simulator.js';

/**
 * بنك الأسئلة المنهجية الثمانية للسنة الثالثة متوسط
 */
export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question: '1. ما هو الفرق العلمي الدقيق بين البؤرة (F) والمركز السطحي للزلزال (E)؟',
    questionHtml: '1. ما هو الفرق العلمي الدقيق بين البؤرة (<span class="math-inline" dir="ltr"><var>F</var></span>) والمركز السطحي للزلزال (<span class="math-inline" dir="ltr"><var>E</var></span>)؟',
    options: [
      'البؤرة نقطة على السطح والمركز السطحي في عمق الأرض',
      'البؤرة منطقة انكسار الصخور في العمق، والمركز السطحي يقع شاقولياً فوقها على السطح وتسجل فيه أقصى شدة I₀',
      'البؤرة تقاس بسلم ميركالي والمركز السطحي يقاس بسلم ريشتر',
      'لا يوجد فرق بينهما فكلاهما يقع على نفس العمق'
    ],
    optionsHtml: [
      'البؤرة نقطة على السطح والمركز السطحي في عمق الأرض',
      'البؤرة منطقة انكسار الصخور في العمق، والمركز السطحي يقع شاقولياً فوقها على السطح وتسجل فيه أقصى شدة <span class="math-inline" dir="ltr"><var>I</var><sub>0</sub></span>',
      'البؤرة تقاس بسلم ميركالي والمركز السطحي يقاس بسلم ريشتر',
      'لا يوجد فرق بينهما فكلاهما يقع على نفس العمق'
    ],
    correctIndex: 1,
    explanation: 'البؤرة (Foyer) تقع في العمق على مستوى الفالق حيث تنطلق الأمواج، أما المركز السطحي (Épicentre) فيقع شاقولياً فوقها على السطح وتصله الأمواج أولاً فتكون الشدة فيه أعظمية (I₀).',
    explanationHtml: 'البؤرة (<span class="math-inline" dir="ltr"><var>F</var></span> — Foyer) تقع في العمق على مستوى الفالق حيث تنطلق الأمواج، أما المركز السطحي (<span class="math-inline" dir="ltr"><var>E</var></span> — Épicentre) فيقع شاقولياً فوقها على السطح وتصله الأمواج أولاً فتكون الشدة فيه أعظمية (<span class="math-inline" dir="ltr"><var>I</var><sub>0</sub></span>).'
  },
  {
    id: 'q2',
    question: '2. كيف تؤثر زيادة عمق البؤرة الزلزالية (h) على الشدة في المركز السطحي ومساحة الانتشار؟',
    questionHtml: '2. كيف تؤثر زيادة عمق البؤرة الزلزالية (<span class="math-inline" dir="ltr"><var>h</var></span>) على الشدة في المركز السطحي ومساحة الانتشار؟',
    options: [
      'كلما زاد عمق البؤرة زادت الشدة التدميرية في المركز السطحي',
      'كلما كانت البؤرة قريبة من السطح (h صغير) كانت الشدة في المركز السطحي أكبر وأشد تدميراً في منطقة ضيقة',
      'عمق البؤرة لا يؤثر إطلاقاً على حجم الخسائر السطحية',
      'البؤرة العميقة تمنع انتشار الموجات الأولية P'
    ],
    optionsHtml: [
      'كلما زاد عمق البؤرة زادت الشدة التدميرية في المركز السطحي',
      'كلما كانت البؤرة قريبة من السطح (<span class="math-inline" dir="ltr"><var>h</var></span> صغير) كانت الشدة في المركز السطحي أكبر وأشد تدميراً في منطقة ضيقة',
      'عمق البؤرة لا يؤثر إطلاقاً على حجم الخسائر السطحية',
      'البؤرة العميقة تمنع انتشار الموجات الأولية <span class="math-inline" dir="ltr"><var>P</var></span>'
    ],
    correctIndex: 1,
    explanation: 'عندما تكون البؤرة قريبة من السطح (ضحلة)، تقطع الأمواج مسافة قصيرة فلا تتخامد طاقتها، فيكون الدمار شديداً في المركز السطحي ضمن مساحة ضيقة.',
    explanationHtml: 'عندما تكون البؤرة قريبة من السطح (<span class="math-inline" dir="ltr"><var>h</var></span> صغير)، تقطع الأمواج مسافة قصيرة فلا تتخامد طاقتها، فيكون الدمار شديداً في المركز السطحي (<span class="math-inline" dir="ltr"><var>I</var><sub>0</sub></span> عظمى) ضمن مساحة ضيقة.'
  },
  {
    id: 'q3',
    question: '3. ما هو الترتيب الزمني الصحيح لوصول الموجات الزلزالية إلى محطة الرصد (السيزموغراف)؟',
    questionHtml: '3. ما هو الترتيب الزمني الصحيح لوصول الموجات الزلزالية إلى محطة الرصد (السيزموغراف)؟',
    options: [
      'تصل الموجات السطحية L أولاً ثم S ثم P',
      'تصل الموجات الثانوية S أولاً ثم الأولية P ثم السطحية L',
      'تصل الموجات الأولية P أولاً (الأسرع)، تليها الثانوية S، وأخيراً الموجات السطحية L (الأبطأ والأشد تدميراً)',
      'تصل جميع الموجات P و S و L في نفس اللحظة الزمنية'
    ],
    optionsHtml: [
      'تصل الموجات السطحية <span class="math-inline" dir="ltr"><var>L</var></span> أولاً ثم <span class="math-inline" dir="ltr"><var>S</var></span> ثم <span class="math-inline" dir="ltr"><var>P</var></span>',
      'تصل الموجات الثانوية <span class="math-inline" dir="ltr"><var>S</var></span> أولاً ثم الأولية <span class="math-inline" dir="ltr"><var>P</var></span> ثم السطحية <span class="math-inline" dir="ltr"><var>L</var></span>',
      'تصل الموجات الأولية <span class="math-inline" dir="ltr"><var>P</var></span> أولاً (الأسرع)، تليها الثانوية <span class="math-inline" dir="ltr"><var>S</var></span>، وأخيراً الموجات السطحية <span class="math-inline" dir="ltr"><var>L</var></span> (الأبطأ والأشد تدميراً)',
      'تصل جميع الموجات <span class="math-inline" dir="ltr"><var>P</var></span> و <span class="math-inline" dir="ltr"><var>S</var></span> و <span class="math-inline" dir="ltr"><var>L</var></span> في نفس اللحظة الزمنية'
    ],
    correctIndex: 2,
    explanation: 'الموجة الأولية P طولية تضاغطية وهي الأسرع (≈ 6 km/s) فتسجل أولاً، تليها الموجة الثانوية القصية S (≈ 3.5 km/s)، ثم الموجة السطحية L البطيئة ذات السعة العظمى.',
    explanationHtml: 'الموجة الأولية <span class="math-inline" dir="ltr"><var>P</var></span> طولية تضاغطية وهي الأسرع (<span class="math-inline" dir="ltr"><var>v</var><sub>P</sub> ≈ 6 <span class="math-unit">km/s</span></span>) فتسجل أولاً، تليها الموجة الثانوية القصية <span class="math-inline" dir="ltr"><var>S</var></span> (<span class="math-inline" dir="ltr"><var>v</var><sub>S</sub> ≈ 3.5 <span class="math-unit">km/s</span></span>)، ثم الموجة السطحية <span class="math-inline" dir="ltr"><var>L</var></span> البطيئة ذات السعة العظمى.'
  },
  {
    id: 'q4',
    question: '4. سجلت محطة رصد فارق زمن وصول بين الموجتين P و S قدره Δt = 10 ثوانٍ. إذا علمت أن معامل السرعة 8.4 km/s، فما هي المسافة البؤرية d؟',
    questionHtml: '4. سجلت محطة رصد فارق زمن وصول بين الموجتين <span class="math-inline" dir="ltr"><var>P</var></span> و <span class="math-inline" dir="ltr"><var>S</var></span> قدره <span class="math-inline" dir="ltr">Δ<var>t</var> = 10 <span class="math-unit">s</span></span>. إذا علمت أن معامل السرعة <span class="math-inline" dir="ltr">8.4 <span class="math-unit">km/s</span></span>، فما هي المسافة البؤرية <span class="math-inline" dir="ltr"><var>d</var></span>؟',
    options: [
      'd = 42 كم',
      'd = 84 كم',
      'd = 120 كم',
      'd = 10 كم'
    ],
    optionsHtml: [
      '<span class="math-inline" dir="ltr"><var>d</var> = 42 <span class="math-unit">km</span></span> (42 كم)',
      '<span class="math-inline" dir="ltr"><var>d</var> = 84 <span class="math-unit">km</span></span> (84 كم)',
      '<span class="math-inline" dir="ltr"><var>d</var> = 120 <span class="math-unit">km</span></span> (120 كم)',
      '<span class="math-inline" dir="ltr"><var>d</var> = 10 <span class="math-unit">km</span></span> (10 كم)'
    ],
    correctIndex: 1,
    explanation: 'بتطبيق قانون المسافة البؤرية: d = Δt × (vP × vS)/(vP - vS) = 10 × 8.4 = 84 كم.',
    explanationHtml: 'بتطبيق قانون المسافة البؤرية: <span class="math-inline" dir="ltr"><var>d</var> = Δ<var>t</var> × <span class="math-frac"><span class="math-num"><var>v</var><sub>P</sub> × <var>v</var><sub>S</sub></span><span class="math-den"><var>v</var><sub>P</sub> − <var>v</var><sub>S</sub></span></span> = 10 × 8.4 = <strong>84 <span class="math-unit">km</span></strong></span>.'
  },
  {
    id: 'q5',
    question: '5. بكم مرة تتضاعف سعة الموجات الزلزالية (A) والطاقة المحررة (E) عند زيادة مقدار الزلزال بدرجتين (ΔM = 2) على سلم ريشتر؟',
    questionHtml: '5. بكم مرة تتضاعف سعة الموجات الزلزالية (<span class="math-inline" dir="ltr"><var>A</var></span>) والطاقة المحررة (<span class="math-inline" dir="ltr"><var>E</var></span>) عند زيادة مقدار الزلزال بدرجتين (<span class="math-inline" dir="ltr">Δ<var>M</var> = 2</span>) على سلم ريشتر؟',
    options: [
      'تتضاعف السعة مرتين والطاقة 4 مرات',
      'تتضاعف السعة 20 مرة والطاقة 60 مرة',
      'تتضاعف السعة 100 مرة (10²) وتتضاعف الطاقة 1000 مرة (10³)',
      'تبقى السعة ثابتة وتتضاعف الطاقة 10 مرات'
    ],
    optionsHtml: [
      'تتضاعف السعة مرتين والطاقة 4 مرات',
      'تتضاعف السعة 20 مرة والطاقة 60 مرة',
      'تتضاعف السعة 100 مرة (<span class="math-inline" dir="ltr">10<sup>2</sup></span>) وتتضاعف الطاقة 1000 مرة (<span class="math-inline" dir="ltr">10<sup>3</sup></span>)',
      'تبقى السعة ثابتة وتتضاعف الطاقة 10 مرات'
    ],
    correctIndex: 2,
    explanation: 'سلم ريشتر لوغاريتمي: زيادة درجتين تعني A2/A1 = 10² = 100 مرة في السعة، وحسب قانون غوتنبرغ-ريشتر E2/E1 = 10^(1.5×2) = 10³ = 1000 مرة في الطاقة.',
    explanationHtml: 'سلم ريشتر لوغاريتمي: زيادة درجتين تعني <span class="math-inline" dir="ltr"><span class="math-frac"><span class="math-num"><var>A</var><sub>2</sub></span><span class="math-den"><var>A</var><sub>1</sub></span></span> = 10<sup>2</sup> = 100</span> مرة في السعة، وحسب قانون غوتنبرغ-ريشتر <span class="math-inline" dir="ltr"><span class="math-frac"><span class="math-num"><var>E</var><sub>2</sub></span><span class="math-den"><var>E</var><sub>1</sub></span></span> = 10<sup>(1.5 × 2)</sup> = 10<sup>3</sup> = 1000</span> مرة في الطاقة.'
  },
  {
    id: 'q6',
    question: '6. ما هو أصل الزلازل التكتونية في شمال الجزائر (مثل زلزال الشلف وبومرداس)؟',
    questionHtml: '6. ما هو أصل الزلازل التكتونية في شمال الجزائر (مثل زلزال الشلف وبومرداس)؟',
    options: [
      'قوى تمدد وتباعد تؤدي إلى فوالق عادية فقط',
      'قوى انضغاط جيولوجية ناتجة عن تقارب الصفيحة الإفريقية نحو الصفيحة الأوراسية محدثة فوالق معكوسة وطيات',
      'سقوط النيازك والانهيارات الجليدية',
      'تقلبات الغلاف الجوي والرياح الموسمية'
    ],
    optionsHtml: [
      'قوى تمدد وتباعد تؤدي إلى فوالق عادية فقط',
      'قوى انضغاط جيولوجية ناتجة عن تقارب الصفيحة الإفريقية نحو الصفيحة الأوراسية محدثة فوالق معكوسة وطيات',
      'سقوط النيازك والانهيارات الجليدية',
      'تقلبات الغلاف الجوي والرياح الموسمية'
    ],
    correctIndex: 1,
    explanation: 'تخضع منطقة شمال الجزائر لقوى انضغاط مستمرة بسبب زحزحة الصفيحة الإفريقية شمالاً نحو الأوراسية، مما يولد فوالق معكوسة نشطة.',
    explanationHtml: 'تخضع منطقة شمال الجزائر لقوى انضغاط مستمرة بسبب زحزحة الصفيحة الإفريقية شمالاً نحو الأوراسية، مما يولد فوالق معكوسة نشطة.'
  },
  {
    id: 'q7',
    question: '7. ما الفائدة العلمية من رسم خريطة المنحنيات متساوية الشدة (Courbes Isoséistes)؟',
    questionHtml: '7. ما الفائدة العلمية من رسم خريطة المنحنيات متساوية الشدة (Courbes Isoséistes)؟',
    options: [
      'تحديد موقع المركز السطحي للزلزال (E) الذي يمثل مركز المنحنى الداخلي ذي الشدة العظمى I₀',
      'قياس سرعة الرياح وقت حدوث الزلزال',
      'منع حدوث الهزات الارتدادية بعد الزلزال',
      'تحويل الموجات P إلى موجات S'
    ],
    optionsHtml: [
      'تحديد موقع المركز السطحي للزلزال (<span class="math-inline" dir="ltr"><var>E</var></span>) الذي يمثل مركز المنحنى الداخلي ذي الشدة العظمى <span class="math-inline" dir="ltr"><var>I</var><sub>0</sub></span>',
      'قياس سرعة الرياح وقت حدوث الزلزال',
      'منع حدوث الهزات الارتدادية بعد الزلزال',
      'تحويل الموجات <span class="math-inline" dir="ltr"><var>P</var></span> إلى موجات <span class="math-inline" dir="ltr"><var>S</var></span>'
    ],
    correctIndex: 0,
    explanation: 'تربط المنحنيات متساوية الشدة بين المدن التي شهدت نفس الشدة الزلزالية، ويدل مركزها ذو الشدة القصوى (I₀) على موقع المركز السطحي (E).',
    explanationHtml: 'تربط المنحنيات متساوية الشدة بين المدن التي شهدت نفس الشدة الزلزالية (<span class="math-inline" dir="ltr"><var>I</var></span>)، ويدل مركزها ذو الشدة القصوى (<span class="math-inline" dir="ltr"><var>I</var><sub>0</sub></span>) على موقع المركز السطحي (<span class="math-inline" dir="ltr"><var>E</var></span>).'
  },
  {
    id: 'q8',
    question: '8. كم عدد محطات الرصد الزلزالي اللازمة على الأقل لتحديد موقع المركز السطحي (E) بدقة بطريقة التثليث الزلزالي؟',
    questionHtml: '8. كم عدد محطات الرصد الزلزالي اللازمة على الأقل لتحديد موقع المركز السطحي (<span class="math-inline" dir="ltr"><var>E</var></span>) بدقة بطريقة التثليث الزلزالي؟',
    options: [
      'محطة رصد واحدة فقط',
      'محطتان اثنتان فقط',
      'ثلاث محطات رصد (S1, S2, S3) حيث تتقاطع الدوائر الثلاث في نقطة واحدة هي المركز السطحي E',
      'عشر محطات في نفس المدينة'
    ],
    optionsHtml: [
      'محطة رصد واحدة فقط',
      'محطتان اثنتان فقط',
      'ثلاث محطات رصد (<span class="math-inline" dir="ltr"><var>S</var><sub>1</sub>, <var>S</var><sub>2</sub>, <var>S</var><sub>3</sub></span>) حيث تتقاطع الدوائر الثلاث في نقطة واحدة هي المركز السطحي <span class="math-inline" dir="ltr"><var>E</var></span>',
      'عشر محطات في نفس المدينة'
    ],
    correctIndex: 2,
    explanation: 'دائرتان تتقاطعان في نقطتين، لذلك نحتاج إلى 3 محطات رصد على الأقل لتحديد نقطة تقاطع وحيدة تمثل المركز السطحي للزلزال (E).',
    explanationHtml: 'دائرتان تتقاطعان في نقطتين، لذلك نحتاج إلى 3 محطات رصد (<span class="math-inline" dir="ltr"><var>S</var><sub>1</sub>, <var>S</var><sub>2</sub>, <var>S</var><sub>3</sub></span>) على الأقل لتحديد نقطة تقاطع وحيدة تمثل المركز السطحي للزلزال (<span class="math-inline" dir="ltr"><var>E</var></span>).'
  }
];

export function initApp() {
  const store = createStore(reduceAppState);
  const audioSynth = new SafeAudioSynthesizer();

  // مراجع عناصر DOM
  const elErrorBanner = document.getElementById('error-banner');
  const elErrorText = document.getElementById('error-message-text');
  const btnErrorReset = document.getElementById('btn-error-reset');

  const btnModeInteractive = document.getElementById('btn-mode-interactive');
  const btnModeWorkbook = document.getElementById('btn-mode-workbook');
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  const elAudioIcon = document.getElementById('audio-icon');
  const elAudioLabel = document.getElementById('audio-label');

  // عناصر المحاكي
  const simCanvas = document.getElementById('sim-canvas');
  const seismoCanvas = document.getElementById('seismogram-canvas');
  const inputMag = document.getElementById('input-magnitude');
  const valMag = document.getElementById('val-magnitude');
  const inputDepth = document.getElementById('input-depth');
  const valDepth = document.getElementById('val-depth');
  const inputDist = document.getElementById('input-distance');
  const valDist = document.getElementById('val-distance');
  const selectFault = document.getElementById('select-fault-type');
  const btnSimTrigger = document.getElementById('btn-sim-trigger');
  const btnSimPause = document.getElementById('btn-sim-pause');
  const btnSimReset = document.getElementById('btn-sim-reset');

  const metricI0 = document.getElementById('metric-epicentral-intensity');
  const metricIx = document.getElementById('metric-station-intensity');
  const metricDeltaT = document.getElementById('metric-delta-t');
  const metricEnergy = document.getElementById('metric-energy-joules');
  const pedagogicalNote = document.getElementById('sim-pedagogical-note');

  // عناصر الحاسبات الرياضية
  const calcVp = document.getElementById('calc-vp');
  const calcVs = document.getElementById('calc-vs');
  const calcDt = document.getElementById('calc-dt');
  const calcDepthH = document.getElementById('calc-depth-h');
  const calcOutHypoD = document.getElementById('calc-out-hypo-d');
  const calcOutSurfaceX = document.getElementById('calc-out-surface-x');
  const calcStepsDistance = document.getElementById('calc-steps-distance');

  const calcAmp = document.getElementById('calc-amp');
  const calcDistX = document.getElementById('calc-dist-x');
  const calcMag1 = document.getElementById('calc-mag-compare-1');
  const calcMag2 = document.getElementById('calc-mag-compare-2');
  const calcOutMl = document.getElementById('calc-out-ml');
  const calcOutEnergy = document.getElementById('calc-out-energy');
  const calcOutRatioAmp = document.getElementById('calc-out-ratio-amp');
  const calcOutRatioEnergy = document.getElementById('calc-out-ratio-energy');
  const calcStepsEnergy = document.getElementById('calc-steps-energy');

  // عناصر التثليث الزلزالي
  const triDt1 = document.getElementById('tri-dt-1');
  const triDt2 = document.getElementById('tri-dt-2');
  const triDt3 = document.getElementById('tri-dt-3');
  const triOutCoords = document.getElementById('tri-out-coords');
  const triSvgContainer = document.getElementById('triangulation-svg-container');

  // عناصر التقويم التفاعلي
  const quizContainer = document.getElementById('quiz-container');
  const quizScoreBadge = document.getElementById('quiz-score-badge');
  const btnQuizCheck = document.getElementById('btn-quiz-check');
  const btnQuizReset = document.getElementById('btn-quiz-reset');

  // حاويات مخططات الـ PDF الأربع
  const svgSlotAnatomy = document.getElementById('svg-anatomy-diagram');
  const svgSlotIsoseismal = document.getElementById('svg-isoseismal-diagram');
  const svgSlotWaves = document.getElementById('svg-waves-seismogram-diagram');
  const svgSlotTriPrint = document.getElementById('svg-triangulation-print-diagram');

  // إنشاء محرك محاكاة الموجات على Canvas
  const waveSimulator = new WaveCanvasSimulator(simCanvas, seismoCanvas, (dt) => {
    store.dispatch({ type: 'TICK_SIMULATION', payload: dt });
  });

  // بناء المخططات الشعاعية الثابتة والديناميكية في كراس الـ PDF
  function renderAllStaticAndDynamicSVGs(state) {
    if (svgSlotAnatomy) {
      svgSlotAnatomy.innerHTML = renderAnatomyDiagramSVG({
        depthKm: state.simulation.depthKm,
        stationDistKm: state.simulation.stationDistKm
      });
    }
    if (svgSlotIsoseismal && !svgSlotIsoseismal.innerHTML.trim()) {
      svgSlotIsoseismal.innerHTML = renderIsoseismalDiagramSVG();
    }
    if (svgSlotWaves && !svgSlotWaves.innerHTML.trim()) {
      svgSlotWaves.innerHTML = renderWavesAndFaultsDiagramSVG();
    }

    const triRes = solveTriangulation(
      undefined,
      state.calculator.triDeltaT,
      state.calculator.vp,
      state.calculator.vs,
      state.calculator.depthH
    );
    const triSvgMarkup = renderTriangulationSVG(triRes);

    if (triSvgContainer) {
      triSvgContainer.innerHTML = triSvgMarkup;
    }
    if (svgSlotTriPrint) {
      svgSlotTriPrint.innerHTML = triSvgMarkup;
    }
    if (triOutCoords) {
      const [s1, s2, s3] = triRes.stations;
      triOutCoords.innerHTML = `
        <div><strong>نتائج التثليث الزلزالي الهندسي:</strong></div>
        <ul>
          <li>نصف قطر دائرة الجزائر (<span class="math-inline" dir="ltr"><var>r</var><sub>1</sub></span>): <strong><span class="math-inline" dir="ltr">${s1.distKm.toFixed(1)} <span class="math-unit">km</span></span> (${s1.distKm.toFixed(1)} كم)</strong></li>
          <li>نصف قطر دائرة وهران (<span class="math-inline" dir="ltr"><var>r</var><sub>2</sub></span>): <strong><span class="math-inline" dir="ltr">${s2.distKm.toFixed(1)} <span class="math-unit">km</span></span> (${s2.distKm.toFixed(1)} كم)</strong></li>
          <li>نصف قطر دائرة قسنطينة (<span class="math-inline" dir="ltr"><var>r</var><sub>3</sub></span>): <strong><span class="math-inline" dir="ltr">${s3.distKm.toFixed(1)} <span class="math-unit">km</span></span> (${s3.distKm.toFixed(1)} كم)</strong></li>
          <li>إحداثيات المركز السطحي المستنتج (<span class="math-inline" dir="ltr"><var>E</var></span>): <strong>${triRes.epicenter.latDeg}° شمالاً، ${triRes.epicenter.lonDeg}° شرقاً</strong></li>
        </ul>
      `;
    }
  }

  // تحديث واجهة المحاكي والمؤشرات اللحظية
  function updateSimulatorUI(state) {
    const sim = state.simulation;
    if (inputMag) inputMag.value = String(sim.magnitude);
    if (valMag) valMag.textContent = `${sim.magnitude.toFixed(1)} درجات`;

    if (inputDepth) inputDepth.value = String(sim.depthKm);
    if (valDepth) valDepth.textContent = `${sim.depthKm} كم`;

    if (inputDist) inputDist.value = String(sim.stationDistKm);
    if (valDist) valDist.textContent = `${sim.stationDistKm} كم`;

    if (selectFault) selectFault.value = sim.faultType;

    const profile = calculateIntensityProfile(sim.magnitude, sim.depthKm, sim.stationDistKm);
    const dtSec = profile.hypoDistKm * (1 / sim.vsKmS - 1 / sim.vpKmS);
    const energyJ = Math.pow(10, 4.8 + 1.5 * sim.magnitude);

    if (metricI0) {
      metricI0.textContent = `${profile.romanI0} (${profile.epicentralIntensity.toFixed(1)}) — ${profile.mercalliDescriptionAr.split('—')[1]?.trim() || ''}`;
    }
    if (metricIx) {
      metricIx.textContent = `${profile.romanIx} (${profile.stationIntensity.toFixed(1)})`;
    }
    if (metricDeltaT) {
      metricDeltaT.textContent = `${dtSec.toFixed(2)} ثانية`;
    }
    if (metricEnergy) {
      metricEnergy.textContent = `${formatScientificAr(energyJ)} جول`;
    }

    if (pedagogicalNote) {
      if (sim.depthKm <= 20) {
        pedagogicalNote.innerHTML = `بؤرة سطحية ضحلة (<span class="math-inline" dir="ltr"><var>h</var> = ${sim.depthKm} <span class="math-unit">km</span></span>): الأمواج تقطع مسافة قصيرة جداً فلا تتخامد، مما يسبب شدة تدميرية عالية في المركز السطحي (<span class="math-inline" dir="ltr"><var>I</var><sub>0</sub> = ${profile.romanI0}</span>) ضمن مساحة ضيقة.`;
      } else if (sim.depthKm >= 100) {
        pedagogicalNote.innerHTML = `بؤرة عميقة (<span class="math-inline" dir="ltr"><var>h</var> = ${sim.depthKm} <span class="math-unit">km</span></span>): الأمواج تقطع مسافة طويلة فتتخامد طاقتها، مما يقلل الشدة في المركز السطحي (<span class="math-inline" dir="ltr"><var>I</var><sub>0</sub> = ${profile.romanI0}</span>) لكن الهزة يشعر بها السكان في مساحة واسعة.`;
      } else {
        pedagogicalNote.innerHTML = `بؤرة متوسطة العمق (<span class="math-inline" dir="ltr"><var>h</var> = ${sim.depthKm} <span class="math-unit">km</span></span>): الشدة في المركز السطحي هي <span class="math-inline" dir="ltr"><var>I</var><sub>0</sub> = ${profile.romanI0}</span> وتتناقص تدريجياً لتصبح <span class="math-inline" dir="ltr"><var>I</var>(<var>x</var>) = ${profile.romanIx}</span> على بعد <span class="math-inline" dir="ltr"><var>x</var> = ${sim.stationDistKm} <span class="math-unit">km</span></span>.`;
      }
    }

    if (btnSimPause) {
      btnSimPause.disabled = sim.status === 'idle';
      btnSimPause.textContent = sim.status === 'paused' ? '▶️ استئناف المحاكاة' : '⏸️ إيقاف مؤقت';
    }

    audioSynth.updateRumble(state.audioEnabled, sim.status === 'running', profile.epicentralIntensity);
    waveSimulator.renderAll(sim);
  }

  // تحديث واجهة الحاسبات الرياضية
  function updateCalculatorsUI(state) {
    const c = state.calculator;

    const distRes = calculateDistanceFromDeltaT(c.deltaT, c.vp, c.vs, c.depthH);
    if (calcOutHypoD) calcOutHypoD.textContent = `${distRes.hypocentralDistKm.toFixed(2)} كم`;
    if (calcOutSurfaceX) calcOutSurfaceX.textContent = `${distRes.epicentralDistKm.toFixed(2)} كم`;
    if (calcStepsDistance) {
      const stepsList = distRes.stepsHtml || distRes.stepsAr;
      calcStepsDistance.innerHTML = `
        <strong>خطوات الحل الرياضي بالتعويض العددي:</strong>
        <ul>${stepsList.map((s) => `<li>${s}</li>`).join('')}</ul>
      `;
    }

    const richRes = calculateRichterAndEnergy(c.amplitudeUm, c.distKm, c.mag1, c.mag2);
    if (calcOutMl) calcOutMl.textContent = `${richRes.localMagnitude.toFixed(2)} درجة`;
    if (calcOutEnergy) calcOutEnergy.textContent = `${formatScientificAr(richRes.energyJoules)} جول`;
    if (calcOutRatioAmp) calcOutRatioAmp.textContent = `${formatScientificAr(richRes.amplitudeRatio)} مرة`;
    if (calcOutRatioEnergy) calcOutRatioEnergy.textContent = `${formatScientificAr(richRes.energyRatio)} مرة`;
    if (calcStepsEnergy) {
      const stepsList = richRes.stepsHtml || richRes.stepsAr;
      calcStepsEnergy.innerHTML = `
        <strong>خطوات الحل الرياضي بالتعويض العددي:</strong>
        <ul>${stepsList.map((s) => `<li>${s}</li>`).join('')}</ul>
      `;
    }
  }

  // بناء وتحديث واجهة التقويم التفاعلي (8 أسئلة)
  function renderQuizUI(state) {
    if (!quizContainer) return;
    const { answers, submitted, score } = state.quiz;

    if (quizScoreBadge) {
      if (!submitted) {
        const answeredCount = Object.keys(answers).length;
        quizScoreBadge.textContent = `تمت الإجابة عن ${answeredCount} من ${QUIZ_QUESTIONS.length} أسئلة`;
      } else {
        const appreciation =
          score >= 7 ? 'ممتاز — تحكم كامل في الكفاءة!' : score >= 5 ? 'جيد — راجع بعض القوانين' : 'يحتاج إلى مراجعة الكراس';
        quizScoreBadge.textContent = `النتيجة النهائية: ${score} / ${QUIZ_QUESTIONS.length} (${appreciation})`;
      }
    }

    quizContainer.innerHTML = QUIZ_QUESTIONS.map((q) => {
      const userChoice = answers[q.id];
      const isCorrect = submitted && userChoice === q.correctIndex;
      const isIncorrect = submitted && userChoice !== q.correctIndex;
      const cardClass = isCorrect ? 'quiz-card correct' : isIncorrect ? 'quiz-card incorrect' : 'quiz-card';

      const displayOptions = q.optionsHtml || q.options;
      const optionsHtml = displayOptions
        .map((optText, idx) => {
          const checked = userChoice === idx ? 'checked' : '';
          return `
            <label class="quiz-option-label">
              <input type="radio" name="quiz-${q.id}" data-question-id="${q.id}" value="${idx}" ${checked} />
              <span>${optText}</span>
            </label>
          `;
        })
        .join('');

      const explanationHtml = submitted
        ? `<div class="quiz-explanation">
             <strong>${isCorrect ? '✅ إجابة صحيحة:' : '❌ الإجابة الصحيحة والتعليل العلمي:'}</strong>
             <div>${q.explanationHtml || q.explanation}</div>
           </div>`
        : '';

      return `
        <article class="${cardClass}">
          <h3 class="quiz-question-title">${q.questionHtml || q.question}</h3>
          <div class="quiz-options">${optionsHtml}</div>
          ${explanationHtml}
        </article>
      `;
    }).join('');
  }

  // محرك الطباعة والتصدير الآمن إلى PDF (Critic Invariant #5)
  function triggerPrintWorkbook() {
    try {
      store.dispatch({ type: 'PAUSE_SIMULATION' });
      renderAllStaticAndDynamicSVGs(store.getState());
      window.print();
    } catch (err) {
      store.dispatch({ type: 'SET_ERROR_STATE', payload: 'تعذر فتح نافذة الطباعة في المتصفح.' });
    }
  }

  // الاشتراك في تغييرات مخزن الحالة
  store.subscribe((state, action) => {
    // وضع العرض (تفاعلي أم معاينة كراس الـ PDF)
    if (state.viewMode === 'workbook') {
      document.body.classList.add('mode-workbook');
      btnModeWorkbook?.classList.add('active');
      btnModeWorkbook?.setAttribute('aria-pressed', 'true');
      btnModeInteractive?.classList.remove('active');
      btnModeInteractive?.setAttribute('aria-pressed', 'false');
    } else {
      document.body.classList.remove('mode-workbook');
      btnModeInteractive?.classList.add('active');
      btnModeInteractive?.setAttribute('aria-pressed', 'true');
      btnModeWorkbook?.classList.remove('active');
      btnModeWorkbook?.setAttribute('aria-pressed', 'false');
    }

    // حالة الصوت
    if (elAudioIcon) elAudioIcon.textContent = state.audioEnabled ? '🔊' : '🔇';
    if (elAudioLabel) {
      elAudioLabel.textContent = state.audioEnabled ? 'الصوت الزلزالي: مفعل' : 'الصوت الزلزالي: مكتوم';
    }
    btnToggleAudio?.setAttribute('aria-pressed', String(state.audioEnabled));

    // شريط الخطأ الاسترجاعي
    if (elErrorBanner) {
      if (state.errorState) {
        elErrorBanner.hidden = false;
        if (elErrorText) elErrorText.textContent = state.errorState;
      } else {
        elErrorBanner.hidden = true;
      }
    }

    updateSimulatorUI(state);

    if (action.type !== 'TICK_SIMULATION') {
      updateCalculatorsUI(state);
      renderAllStaticAndDynamicSVGs(state);
    }

    if (
      action.type === 'SET_QUIZ_ANSWER' ||
      action.type === 'SUBMIT_QUIZ' ||
      action.type === 'RESET_QUIZ' ||
      action.type === 'RECOVER_FROM_ERROR'
    ) {
      renderQuizUI(state);
    }
  });

  // ربط أحداث أزرار الترويسة
  btnModeInteractive?.addEventListener('click', () => {
    store.dispatch({ type: 'SET_VIEW_MODE', payload: 'interactive' });
  });

  btnModeWorkbook?.addEventListener('click', () => {
    store.dispatch({ type: 'SET_VIEW_MODE', payload: 'workbook' });
    document.getElementById('printable-workbook')?.scrollIntoView({ behavior: 'smooth' });
  });

  btnPrintPdf?.addEventListener('click', () => {
    triggerPrintWorkbook();
  });

  window.addEventListener('request-print-pdf', () => {
    triggerPrintWorkbook();
  });

  btnToggleAudio?.addEventListener('click', () => {
    audioSynth.initFromUserGesture();
    store.dispatch({ type: 'TOGGLE_AUDIO' });
  });

  btnErrorReset?.addEventListener('click', () => {
    store.storage.clear();
    store.dispatch({ type: 'RECOVER_FROM_ERROR' });
  });

  // ربط شريط فصول الدرس
  document.querySelectorAll('#chapter-nav .nav-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chapter-nav .nav-pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-section-target');
      if (targetId === 'printable-workbook') {
        document.getElementById('printable-workbook')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        store.dispatch({ type: 'SET_VIEW_MODE', payload: 'interactive' });
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ربط منزلقات وأزرار المحاكي الزلزالي
  const handleSimInputChange = () => {
    store.dispatch({
      type: 'SET_SIM_PARAMS',
      payload: {
        magnitude: parseFloat(inputMag?.value),
        depthKm: parseFloat(inputDepth?.value),
        stationDistKm: parseFloat(inputDist?.value),
        faultType: selectFault?.value
      }
    });
  };

  inputMag?.addEventListener('input', handleSimInputChange);
  inputDepth?.addEventListener('input', handleSimInputChange);
  inputDist?.addEventListener('input', handleSimInputChange);
  selectFault?.addEventListener('change', handleSimInputChange);

  btnSimTrigger?.addEventListener('click', () => {
    audioSynth.initFromUserGesture();
    store.dispatch({ type: 'RESET_SIMULATION' });
    store.dispatch({ type: 'START_SIMULATION' });
    waveSimulator.startLoop(() => store.getState());
  });

  btnSimPause?.addEventListener('click', () => {
    const currentStatus = store.getState().simulation.status;
    if (currentStatus === 'running') {
      store.dispatch({ type: 'PAUSE_SIMULATION' });
      waveSimulator.stopLoop();
    } else if (currentStatus === 'paused') {
      store.dispatch({ type: 'START_SIMULATION' });
      waveSimulator.startLoop(() => store.getState());
    }
  });

  btnSimReset?.addEventListener('click', () => {
    waveSimulator.stopLoop();
    store.dispatch({ type: 'RESET_SIMULATION' });
  });

  // ربط مدخلات الحاسبات الرياضية
  const handleCalcChange = () => {
    store.dispatch({
      type: 'SET_CALC_PARAMS',
      payload: {
        vp: parseFloat(calcVp?.value),
        vs: parseFloat(calcVs?.value),
        deltaT: parseFloat(calcDt?.value),
        depthH: parseFloat(calcDepthH?.value),
        amplitudeUm: parseFloat(calcAmp?.value),
        distKm: parseFloat(calcDistX?.value),
        mag1: parseFloat(calcMag1?.value),
        mag2: parseFloat(calcMag2?.value)
      }
    });
  };

  [calcVp, calcVs, calcDt, calcDepthH, calcAmp, calcDistX, calcMag1, calcMag2].forEach((el) => {
    el?.addEventListener('input', handleCalcChange);
  });

  // ربط مدخلات مختبر التثليث الزلزالي
  const handleTriangulationChange = () => {
    store.dispatch({
      type: 'SET_TRIANGULATION_DT',
      payload: [
        parseFloat(triDt1?.value),
        parseFloat(triDt2?.value),
        parseFloat(triDt3?.value)
      ]
    });
  };

  [triDt1, triDt2, triDt3].forEach((el) => {
    el?.addEventListener('input', handleTriangulationChange);
  });

  // ربط أحداث التقويم التفاعلي
  quizContainer?.addEventListener('change', (e) => {
    const target = e.target;
    if (target && target.matches('input[type="radio"][data-question-id]')) {
      store.dispatch({
        type: 'SET_QUIZ_ANSWER',
        payload: {
          questionId: target.getAttribute('data-question-id'),
          optionIndex: parseInt(target.value, 10)
        }
      });
    }
  });

  btnQuizCheck?.addEventListener('click', () => {
    const answers = store.getState().quiz.answers;
    let totalScore = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (answers[q.id] === q.correctIndex) {
        totalScore += 1;
      }
    });
    store.dispatch({ type: 'SUBMIT_QUIZ', payload: { score: totalScore } });
  });

  btnQuizReset?.addEventListener('click', () => {
    store.dispatch({ type: 'RESET_QUIZ' });
  });

  // حارس الأخطاء العام في المتصفح
  window.addEventListener('error', (event) => {
    if (event?.message) {
      store.dispatch({ type: 'SET_ERROR_STATE', payload: event.message });
    }
  });

  // التهيئة الأولية لجميع المكونات الرسومية والحسابية
  const initialState = store.getState();
  renderAllStaticAndDynamicSVGs(initialState);
  updateSimulatorUI(initialState);
  updateCalculatorsUI(initialState);
  renderQuizUI(initialState);

  return { store, waveSimulator };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
