/**
 * js/svg-diagrams.js
 * مولد المخططات الهندسية والرسوم التوضيحية الشعاعية (SVG) عالية الدقة للعرض التفاعلي والطباعة بحجم A4
 */

/**
 * 1. المخطط التشريحي الكامل للزلزال (البؤرة F، المركز السطحي E، الفالق، العمق h، المسافة السطحية x، الشعاع الزلزالي d)
 */
export function renderAnatomyDiagramSVG(params = {}) {
  const depthKm = params.depthKm ?? 15;
  const distKm = params.stationDistKm ?? 80;
  const hypoDist = Math.sqrt(depthKm * depthKm + distKm * distKm).toFixed(1);

  return `
  <svg viewBox="0 0 840 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="المقطع التشريحي للزلزال">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e0f2fe" />
        <stop offset="100%" stop-color="#f8fafc" />
      </linearGradient>
      <linearGradient id="crustGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d6d3d1" />
        <stop offset="50%" stop-color="#a8a29e" />
        <stop offset="100%" stop-color="#78716c" />
      </linearGradient>
      <linearGradient id="mantleGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#57534e" />
        <stop offset="100%" stop-color="#44403c" />
      </linearGradient>
      <marker id="arrowRed" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
      </marker>
      <marker id="arrowBlue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
      </marker>
      <marker id="arrowPurple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
      </marker>
    </defs>

    <!-- السماء -->
    <rect x="0" y="0" width="840" height="82" fill="url(#skyGrad)" />

    <!-- طبقة التربة السطحية -->
    <rect x="0" y="82" width="840" height="14" fill="#65a30d" />
    <!-- القشرة الأرضية القارية -->
    <rect x="0" y="96" width="840" height="145" fill="url(#crustGrad)" />
    <!-- الرداء العلوي (الليتوسفير) -->
    <rect x="0" y="241" width="840" height="69" fill="url(#mantleGrad)" />

    <!-- خطوط الطبقات الرسوبية المقطوعة بالفالق -->
    <line x1="0" y1="138" x2="298" y2="138" stroke="#57534e" stroke-width="1.5" stroke-dasharray="6,4" />
    <line x1="306" y1="128" x2="840" y2="128" stroke="#57534e" stroke-width="1.5" stroke-dasharray="6,4" />
    <line x1="0" y1="185" x2="322" y2="185" stroke="#44403c" stroke-width="1.5" stroke-dasharray="6,4" />
    <line x1="330" y1="175" x2="840" y2="175" stroke="#44403c" stroke-width="1.5" stroke-dasharray="6,4" />

    <!-- خط الفالق الزلزالي (الصدع الصخري) -->
    <line x1="255" y1="82" x2="365" y2="295" stroke="#991b1b" stroke-width="4" />
    <text x="372" y="280" fill="#fef08a" font-family="Segoe UI, Tahoma" font-size="12" font-weight="bold">خط الفالق الزلزالي (انكسار الصخور)</text>

    <!-- أسهم قوى الانضغاط الجيولوجية -->
    <line x1="85" y1="215" x2="175" y2="215" stroke="#dc2626" stroke-width="3.5" marker-end="url(#arrowRed)" />
    <text x="130" y="204" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">قوى انضغاط</text>

    <!-- دوائر جبهات الأمواج الزلزالية المنطلقة من البؤرة F -->
    <circle cx="315" cy="205" r="32" fill="none" stroke="#fef08a" stroke-width="2" stroke-dasharray="5,3" />
    <circle cx="315" cy="205" r="65" fill="none" stroke="#fde047" stroke-width="1.8" stroke-dasharray="6,4" />
    <circle cx="315" cy="205" r="102" fill="none" stroke="#38bdf8" stroke-width="1.6" stroke-dasharray="7,4" />
    <circle cx="315" cy="205" r="145" fill="none" stroke="#0284c7" stroke-width="1.4" stroke-dasharray="8,5" />
    <circle cx="315" cy="205" r="195" fill="none" stroke="#0369a1" stroke-width="1.2" stroke-dasharray="8,6" />

    <!-- المثلث الهندسي القائم (F - E - S): العمق h، المسافة السطحية x، الشعاع الزلزالي d -->
    <!-- العمق الشاقولي h -->
    <line x1="315" y1="86" x2="315" y2="201" stroke="#dc2626" stroke-width="3" stroke-dasharray="4,3" marker-start="url(#arrowRed)" marker-end="url(#arrowRed)" />
    <rect x="208" y="132" width="98" height="24" rx="4" fill="#ffffff" stroke="#dc2626" stroke-width="1.2" />
    <text x="257" y="148" text-anchor="middle" fill="#b91c1c" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">العمق h = ${depthKm} كم</text>

    <!-- المسافة السطحية x بين المركز السطحي E ومحطة الرصد S -->
    <line x1="319" y1="82" x2="616" y2="82" stroke="#0284c7" stroke-width="3.2" marker-start="url(#arrowBlue)" marker-end="url(#arrowBlue)" />
    <rect x="415" y="54" width="138" height="22" rx="4" fill="#f0f9ff" stroke="#0284c7" stroke-width="1.2" />
    <text x="484" y="69" text-anchor="middle" fill="#0369a1" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">المسافة السطحية x = ${distKm} كم</text>

    <!-- الشعاع الزلزالي (المسافة البؤرية d_hypo) -->
    <line x1="319" y1="203" x2="616" y2="85" stroke="#7c3aed" stroke-width="3" marker-end="url(#arrowPurple)" />
    <rect x="430" y="146" width="168" height="24" rx="4" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.2" />
    <text x="514" y="162" text-anchor="middle" fill="#5b21b6" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">المسافة البؤرية d = ${hypoDist} كم</text>

    <!-- رمز الزاوية القائمة في المركز السطحي E -->
    <polyline points="315,96 329,96 329,82" fill="none" stroke="#0f172a" stroke-width="1.8" />

    <!-- البؤرة الزلزالية F -->
    <circle cx="315" cy="205" r="11" fill="#dc2626" stroke="#ffffff" stroke-width="2.5" />
    <text x="315" y="209" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="12" font-weight="bold">F</text>
    <rect x="165" y="218" width="138" height="24" rx="4" fill="#fef2f2" stroke="#dc2626" />
    <text x="234" y="234" text-anchor="middle" fill="#991b1b" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">البؤرة الزلزالية (F)</text>

    <!-- المركز السطحي E + مبانٍ متصدعة فوقه مباشرة -->
    <g transform="translate(285, 38)">
      <!-- مبنى متضرر بشدة في المركز السطحي -->
      <polygon points="8,44 8,14 28,14 28,44" fill="#cbd5e1" stroke="#334155" stroke-width="1.5" transform="rotate(-6 18 44)" />
      <polyline points="12,18 20,28 15,36 24,42" fill="none" stroke="#dc2626" stroke-width="2" />
      <polygon points="34,44 34,8 56,8 56,44" fill="#94a3b8" stroke="#1e293b" stroke-width="1.5" transform="rotate(5 45 44)" />
      <polyline points="39,12 48,24 41,33 50,42" fill="none" stroke="#dc2626" stroke-width="2" />
    </g>
    <circle cx="315" cy="82" r="9" fill="#e11d48" stroke="#ffffff" stroke-width="2" />
    <text x="315" y="86" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="11" font-weight="bold">E</text>
    <rect x="230" y="8" width="175" height="24" rx="4" fill="#ffe4e6" stroke="#e11d48" stroke-width="1.5" />
    <text x="317" y="24" text-anchor="middle" fill="#9f1239" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">المركز السطحي (E) — أقصى شدة I₀</text>

    <!-- محطة الرصد الزلزالي S + هوائي السيزموغراف -->
    <g transform="translate(605, 42)">
      <rect x="0" y="18" width="34" height="22" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.8" />
      <polygon points="-3,18 17,4 37,18" fill="#0284c7" />
      <line x1="17" y1="4" x2="17" y2="-8" stroke="#0f172a" stroke-width="2" />
      <circle cx="17" cy="-8" r="3" fill="#ef4444" />
    </g>
    <circle cx="622" cy="82" r="7" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
    <rect x="558" y="8" width="145" height="24" rx="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.5" />
    <text x="630" y="24" text-anchor="middle" fill="#075985" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">محطة الرصد الزلزالي (S)</text>

    <!-- تسميات الطبقات الجيولوجية على اليمين -->
    <rect x="705" y="110" width="122" height="24" rx="4" fill="rgba(255,255,255,0.88)" stroke="#475569" />
    <text x="766" y="126" text-anchor="middle" fill="#0f172a" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">القشرة الأرضية الصلبة</text>

    <rect x="705" y="255" width="122" height="24" rx="4" fill="rgba(255,255,255,0.88)" stroke="#475569" />
    <text x="766" y="271" text-anchor="middle" fill="#0f172a" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">الرداء العلوي</text>
  </svg>`;
}

/**
 * 2. مخطط المنحنيات متساوية الشدة (Isoseismal Lines) ومقارنة البؤرة السطحية والعميقة
 */
export function renderIsoseismalDiagramSVG() {
  return `
  <svg viewBox="0 0 840 275" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="المنحنيات متساوية الشدة ومقارنة عمق البؤرة">
    <!-- الإطار الأيمن: خريطة المنحنيات متساوية الشدة -->
    <g transform="translate(430, 8)">
      <rect x="0" y="0" width="400" height="258" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <rect x="0" y="0" width="400" height="28" rx="6" fill="#1e3a8a" />
      <text x="200" y="19" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="12" font-weight="bold">أ) خريطة المنحنيات متساوية الشدة (Courbes Isoséistes)</text>

      <!-- المنحنيات المتداخلة حول المركز السطحي E -->
      <ellipse cx="205" cy="145" rx="165" ry="92" fill="#ecfccb" stroke="#65a30d" stroke-width="1.8" stroke-dasharray="5,3" />
      <ellipse cx="205" cy="145" rx="126" ry="70" fill="#fef9c3" stroke="#ca8a04" stroke-width="1.8" />
      <ellipse cx="205" cy="145" rx="86" ry="48" fill="#ffedd5" stroke="#ea580c" stroke-width="2" />
      <ellipse cx="205" cy="145" rx="45" ry="26" fill="#fee2e2" stroke="#dc2626" stroke-width="2.2" />

      <!-- النجمة في المركز السطحي E -->
      <circle cx="205" cy="145" r="7" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" />
      <text x="205" y="132" text-anchor="middle" fill="#991b1b" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">المركز السطحي E (I₀ = IX)</text>

      <!-- قيم الشدة على المنحنيات -->
      <text x="272" y="149" fill="#9a3412" font-family="Arial" font-size="11" font-weight="bold">I = VIII</text>
      <text x="312" y="149" fill="#854d0e" font-family="Arial" font-size="11" font-weight="bold">I = VII</text>
      <text x="350" y="149" fill="#3f6212" font-family="Arial" font-size="11" font-weight="bold">I = VI</text>

      <!-- مدن على نفس المنحنى -->
      <circle cx="119" cy="145" r="4" fill="#1e293b" />
      <text x="108" y="162" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10" font-weight="bold">مدينة (أ)</text>
      <circle cx="205" cy="97" r="4" fill="#1e293b" />
      <text x="205" y="90" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10" font-weight="bold">مدينة (ب)</text>

      <text x="200" y="249" text-anchor="middle" fill="#334155" font-family="Segoe UI, Tahoma" font-size="10.5" font-weight="bold">تتناقص الشدة الزلزالية كلما ابتعدنا عن المركز السطحي E</text>
    </g>

    <!-- الإطار الأيسر: مقارنة بؤرة قريبة مقابل بؤرة عميقة -->
    <g transform="translate(10, 8)">
      <rect x="0" y="0" width="405" height="258" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <rect x="0" y="0" width="405" height="28" rx="6" fill="#0f172a" />
      <text x="202" y="19" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="12" font-weight="bold">ب) أثر عمق البؤرة (h) على الشدة السطحية ومساحة الضرر</text>

      <!-- خط الفصل العمودي -->
      <line x1="202" y1="32" x2="202" y2="250" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,4" />

      <!-- 1. بؤرة سطحية قريبة (يمين المخطط الجزئي) -->
      <text x="303" y="48" text-anchor="middle" fill="#b91c1c" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">1. بؤرة قريبة من السطح (h صغير)</text>
      <rect x="214" y="88" width="178" height="125" fill="#d6d3d1" stroke="#78716c" />
      <line x1="214" y1="88" x2="392" y2="88" stroke="#15803d" stroke-width="4" />
      <!-- نطاق الضرر الضيق والشديد -->
      <rect x="273" y="80" width="60" height="8" fill="#dc2626" />
      <text x="303" y="74" text-anchor="middle" fill="#dc2626" font-family="Segoe UI" font-size="10" font-weight="bold">دمار شديد في مساحة ضيقة</text>
      <!-- البؤرة القريبة -->
      <circle cx="303" cy="122" r="7" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" />
      <text x="322" y="126" fill="#7f1d1d" font-family="Arial" font-size="10.5" font-weight="bold">F₁ (h=10km)</text>
      <circle cx="303" cy="122" r="22" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,2" />
      <circle cx="303" cy="122" r="36" fill="none" stroke="#ea580c" stroke-width="1.2" stroke-dasharray="3,2" />
      <text x="303" y="232" text-anchor="middle" fill="#991b1b" font-family="Segoe UI" font-size="10.5" font-weight="bold">مسار قصير ← تخامد ضعيف ← I₀ كبيرة جداً</text>

      <!-- 2. بؤرة عميقة (يسار المخطط الجزئي) -->
      <text x="101" y="48" text-anchor="middle" fill="#0369a1" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">2. بؤرة عميقة جداً (h كبير)</text>
      <rect x="12" y="88" width="178" height="125" fill="#d6d3d1" stroke="#78716c" />
      <line x1="12" y1="88" x2="190" y2="88" stroke="#15803d" stroke-width="4" />
      <!-- نطاق الضرر الواسع والخفيف -->
      <rect x="22" y="81" width="158" height="7" fill="#f59e0b" />
      <text x="101" y="74" text-anchor="middle" fill="#b45309" font-family="Segoe UI" font-size="10" font-weight="bold">شدة أقل في مساحة واسعة</text>
      <!-- البؤرة العميقة -->
      <circle cx="101" cy="192" r="7" fill="#0284c7" stroke="#ffffff" stroke-width="1.5" />
      <text x="135" y="196" fill="#0c4a6e" font-family="Arial" font-size="10.5" font-weight="bold">F₂ (h=120km)</text>
      <circle cx="101" cy="192" r="38" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4,3" />
      <circle cx="101" cy="192" r="72" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4,3" />
      <circle cx="101" cy="192" r="104" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4,3" />
      <text x="101" y="232" text-anchor="middle" fill="#075985" font-family="Segoe UI" font-size="10.5" font-weight="bold">مسار طويل ← تخامد كبير ← I₀ متوسطة</text>
    </g>
  </svg>`;
}

/**
 * 3. مخطط المسجل الزلزالي (السيزموغراف)، السيزموغرام (P, S, L)، وأنواع الفوالق الثلاثة
 */
export function renderWavesAndFaultsDiagramSVG() {
  return `
  <svg viewBox="0 0 840 285" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="المسجل الزلزالي والسيزموغرام وأنواع الفوالق">
    <!-- القسم الأيمن: المسجل الزلزالي الميكانيكي (السيزموغراف) -->
    <g transform="translate(575, 8)">
      <rect x="0" y="0" width="255" height="268" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <rect x="0" y="0" width="255" height="26" rx="6" fill="#1e293b" />
      <text x="127" y="17" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">1. المسجل الزلزالي (السيزموغراف)</text>

      <!-- القاعدة المثبتة في الأرض -->
      <rect x="28" y="218" width="200" height="22" fill="#78716c" stroke="#334155" stroke-width="1.5" />
      <text x="128" y="233" text-anchor="middle" fill="#ffffff" font-family="Segoe UI" font-size="10" font-weight="bold">قاعدة مثبتة في صخور القشرة الأرضية</text>

      <!-- العمود الحامل -->
      <polyline points="55,218 55,55 135,55" fill="none" stroke="#334155" stroke-width="5" />
      <!-- النابض المرن -->
      <polyline points="135,55 125,65 145,75 125,85 145,95 135,105" fill="none" stroke="#0284c7" stroke-width="2.5" />
      <!-- الثقل المعلق (كتلة العطالة) -->
      <circle cx="135" cy="128" r="22" fill="#334155" stroke="#0f172a" stroke-width="2" />
      <text x="135" y="132" text-anchor="middle" fill="#ffffff" font-family="Segoe UI" font-size="10" font-weight="bold">ثقل ساكن</text>
      <!-- القلم المسجل -->
      <line x1="157" y1="128" x2="182" y2="128" stroke="#dc2626" stroke-width="2.5" />
      <!-- الأسطوانة الدوارة -->
      <rect x="182" y="96" width="44" height="68" rx="6" fill="#ffffff" stroke="#0f172a" stroke-width="2" />
      <path d="M 204 98 L 204 115 L 196 120 L 214 126 L 190 133 L 218 140 L 204 147 L 204 162" fill="none" stroke="#dc2626" stroke-width="1.8" />
      <text x="204" y="182" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10" font-weight="bold">أسطوانة دوارة</text>
    </g>

    <!-- القسم الأوسط: تحليل مخطط السيزموغرام (P, S, L) -->
    <g transform="translate(260, 8)">
      <rect x="0" y="0" width="305" height="268" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <rect x="0" y="0" width="305" height="26" rx="6" fill="#0369a1" />
      <text x="152" y="17" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">2. قراءة التسجيل الزلزالي (السيزموغرام)</text>

      <!-- شبكة ورق السيزموغرام -->
      <rect x="12" y="38" width="280" height="145" fill="#ffffff" stroke="#94a3b8" />
      <line x1="12" y1="110" x2="292" y2="110" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3,3" />

      <!-- منحنى السيزموغرام (اتجاه الزمن من اليسار لليمين) -->
      <path d="M 16 110 L 52 110
               L 56 96 L 60 124 L 64 99 L 68 120 L 73 104 L 78 116 L 85 108 L 118 110
               L 123 78 L 129 142 L 135 74 L 142 146 L 149 85 L 156 132 L 165 98 L 185 110
               L 192 48 L 201 172 L 210 45 L 220 175 L 230 56 L 240 162 L 250 75 L 260 140 L 272 95 L 288 110"
            fill="none" stroke="#0f172a" stroke-width="1.8" />

      <!-- معالم الأزمنة t0, tP, tS, L -->
      <line x1="25" y1="42" x2="25" y2="178" stroke="#64748b" stroke-width="1.2" stroke-dasharray="3,2" />
      <text x="25" y="54" text-anchor="middle" fill="#475569" font-family="Arial" font-size="10" font-weight="bold">t₀</text>

      <line x1="54" y1="42" x2="54" y2="178" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="3,2" />
      <text x="66" y="54" text-anchor="middle" fill="#0284c7" font-family="Arial" font-size="10.5" font-weight="bold">موجة P (tP)</text>

      <line x1="120" y1="42" x2="120" y2="178" stroke="#d97706" stroke-width="1.5" stroke-dasharray="3,2" />
      <text x="145" y="54" text-anchor="middle" fill="#b45309" font-family="Arial" font-size="10.5" font-weight="bold">موجة S (tS)</text>

      <line x1="188" y1="42" x2="188" y2="178" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,2" />
      <text x="235" y="54" text-anchor="middle" fill="#dc2626" font-family="Arial" font-size="10.5" font-weight="bold">موجات سطحية L</text>

      <!-- قوس فارق الزمن Δt = tS - tP -->
      <line x1="54" y1="168" x2="120" y2="168" stroke="#7c3aed" stroke-width="2.5" />
      <text x="87" y="163" text-anchor="middle" fill="#6d28d9" font-family="Arial" font-size="10.5" font-weight="bold">Δt = tS - tP</text>

      <text x="152" y="205" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10.5" font-weight="bold">• الموجة P: سريعة، طولية (تصل أولاً)</text>
      <text x="152" y="224" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10.5" font-weight="bold">• الموجة S: متوسطة، مستعرضة (تصل ثانياً)</text>
      <text x="152" y="243" text-anchor="middle" fill="#dc2626" font-family="Segoe UI" font-size="10.5" font-weight="bold">• الموجة L: بطيئة، سطحية عالية السعة (الأشد تدميراً)</text>
    </g>

    <!-- القسم الأيسر: أنواع الفوالق الجيولوجية الثلاثة -->
    <g transform="translate(10, 8)">
      <rect x="0" y="0" width="240" height="268" rx="6" fill="#f8fafc" stroke="#64748b" stroke-width="1.5" />
      <rect x="0" y="0" width="240" height="26" rx="6" fill="#991b1b" />
      <text x="120" y="17" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Tahoma" font-size="11.5" font-weight="bold">3. أنواع الفوالق الجيولوجية</text>

      <!-- أ) فالق عادي -->
      <g transform="translate(15, 36)">
        <polygon points="10,18 95,18 110,58 10,58" fill="#d6d3d1" stroke="#44403c" />
        <polygon points="98,28 200,28 200,68 113,68" fill="#a8a29e" stroke="#44403c" />
        <line x1="95" y1="14" x2="115" y2="70" stroke="#dc2626" stroke-width="2.5" />
        <text x="105" y="12" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10.5" font-weight="bold">أ) فالق عادي (قوى تمدد ← →)</text>
      </g>

      <!-- ب) فالق معكوس -->
      <g transform="translate(15, 114)">
        <polygon points="10,28 95,28 112,68 10,68" fill="#d6d3d1" stroke="#44403c" />
        <polygon points="90,14 200,14 200,54 107,54" fill="#a8a29e" stroke="#44403c" />
        <line x1="88" y1="10" x2="114" y2="70" stroke="#dc2626" stroke-width="2.5" />
        <text x="105" y="10" text-anchor="middle" fill="#991b1b" font-family="Segoe UI" font-size="10.5" font-weight="bold">ب) فالق معكوس (قوى انضغاط → ←)</text>
      </g>

      <!-- ج) فالق انزلاقي -->
      <g transform="translate(15, 192)">
        <polygon points="15,24 105,24 95,62 5,62" fill="#d6d3d1" stroke="#44403c" />
        <polygon points="108,18 198,18 188,56 98,56" fill="#a8a29e" stroke="#44403c" />
        <line x1="106" y1="15" x2="96" y2="65" stroke="#dc2626" stroke-width="2.5" />
        <text x="105" y="12" text-anchor="middle" fill="#0f172a" font-family="Segoe UI" font-size="10.5" font-weight="bold">ج) فالق انزلاقي تحويلي (قص أفقي ⇅)</text>
      </g>
    </g>
  </svg>`;
}

/**
 * 4. مخطط التثليث الزلزالي لتحديد المركز السطحي (تفاعلي وللطباعة)
 */
export function renderTriangulationSVG(triResult) {
  const { stations, epicenter } = triResult;
  const s1 = stations[0];
  const s2 = stations[1];
  const s3 = stations[2];

  return `
  <svg viewBox="0 0 620 295" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="خريطة التثليث الزلزالي بثلاث محطات رصد">
    <!-- خلفية الخريطة الطبوغرافية -->
    <rect x="0" y="0" width="620" height="295" rx="6" fill="#f0f9ff" stroke="#64748b" stroke-width="1.5" />

    <!-- ساحل البحر الأبيض المتوسط واليابسة الجزائرية المبسطة -->
    <path d="M 0,115 Q 110,95 215,75 T 420,65 T 620,55 L 620,295 L 0,295 Z" fill="#f8fafc" stroke="#0284c7" stroke-width="2" />
    <text x="95" y="42" fill="#0369a1" font-family="Segoe UI, Tahoma" font-size="12" font-weight="bold">البحر الأبيض المتوسط</text>

    <!-- خطوط الشبكة الجغرافية -->
    <line x1="0" y1="145" x2="620" y2="145" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
    <line x1="0" y1="220" x2="620" y2="220" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
    <line x1="155" y1="0" x2="155" y2="295" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
    <line x1="310" y1="0" x2="310" y2="295" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
    <line x1="465" y1="0" x2="465" y2="295" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />

    <!-- الدوائر الزلزالية الثلاث (أنصاف أقطارها r1, r2, r3) -->
    <circle cx="${s1.x}" cy="${s1.y}" r="${s1.radiusPx.toFixed(1)}" fill="rgba(2, 132, 199, 0.08)" stroke="#0284c7" stroke-width="2.2" stroke-dasharray="6,3" />
    <circle cx="${s2.x}" cy="${s2.y}" r="${s2.radiusPx.toFixed(1)}" fill="rgba(217, 119, 6, 0.08)" stroke="#d97706" stroke-width="2.2" stroke-dasharray="6,3" />
    <circle cx="${s3.x}" cy="${s3.y}" r="${s3.radiusPx.toFixed(1)}" fill="rgba(124, 58, 237, 0.08)" stroke="#7c3aed" stroke-width="2.2" stroke-dasharray="6,3" />

    <!-- أنصاف الأقطار من المحطات نحو المركز السطحي المستنتج -->
    <line x1="${s1.x}" y1="${s1.y}" x2="${epicenter.x}" y2="${epicenter.y}" stroke="#0284c7" stroke-width="1.4" stroke-dasharray="3,3" />
    <line x1="${s2.x}" y1="${s2.y}" x2="${epicenter.x}" y2="${epicenter.y}" stroke="#d97706" stroke-width="1.4" stroke-dasharray="3,3" />
    <line x1="${s3.x}" y1="${s3.y}" x2="${epicenter.x}" y2="${epicenter.y}" stroke="#7c3aed" stroke-width="1.4" stroke-dasharray="3,3" />

    <!-- المحطة 1: الجزائر -->
    <circle cx="${s1.x}" cy="${s1.y}" r="6.5" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
    <text x="${s1.x}" y="${s1.y - 11}" text-anchor="middle" fill="#075985" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">S₁ الجزائر (r₁=${s1.distKm.toFixed(0)} كم)</text>

    <!-- المحطة 2: وهران -->
    <circle cx="${s2.x}" cy="${s2.y}" r="6.5" fill="#d97706" stroke="#ffffff" stroke-width="2" />
    <text x="${s2.x}" y="${s2.y + 20}" text-anchor="middle" fill="#92400e" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">S₂ وهران (r₂=${s2.distKm.toFixed(0)} كم)</text>

    <!-- المحطة 3: قسنطينة -->
    <circle cx="${s3.x}" cy="${s3.y}" r="6.5" fill="#7c3aed" stroke="#ffffff" stroke-width="2" />
    <text x="${s3.x}" y="${s3.y + 20}" text-anchor="middle" fill="#5b21b6" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">S₃ قسنطينة (r₃=${s3.distKm.toFixed(0)} كم)</text>

    <!-- المركز السطحي الناتج عن التقاطع (E) -->
    <circle cx="${epicenter.x}" cy="${epicenter.y}" r="14" fill="rgba(225, 29, 72, 0.25)" />
    <circle cx="${epicenter.x}" cy="${epicenter.y}" r="8" fill="#e11d48" stroke="#ffffff" stroke-width="2" />
    <text x="${epicenter.x}" y="${epicenter.y + 4}" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="10" font-weight="bold">E</text>

    <rect x="${Math.min(440, Math.max(15, epicenter.x - 78))}" y="${Math.max(12, epicenter.y - 36)}" width="156" height="22" rx="4" fill="#ffe4e6" stroke="#e11d48" stroke-width="1.5" />
    <text x="${Math.min(518, Math.max(93, epicenter.x))}" y="${Math.max(27, epicenter.y - 21)}" text-anchor="middle" fill="#9f1239" font-family="Segoe UI, Tahoma" font-size="11" font-weight="bold">نقطة التقاطع = المركز السطحي E</text>
  </svg>`;
}
