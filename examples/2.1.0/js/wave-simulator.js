/**
 * js/wave-simulator.js
 * محرك المحاكاة الحية للموجات الزلزالية (P, S, L) والمسجل الزلزالي (السيزموغرام) على Canvas
 * يعمل بميزانية إطار < 16ms مع حارس دلتا الزمن (dt <= 0.05s)
 */

import { calculateIntensityProfile } from './seismic-laws.js';

export class WaveCanvasSimulator {
  constructor(simCanvas, seismogramCanvas, onTickCallback) {
    this.simCanvas = simCanvas;
    this.seismoCanvas = seismogramCanvas;
    this.onTickCallback = onTickCallback;

    this.simCtx = simCanvas ? simCanvas.getContext('2d') : null;
    this.seismoCtx = seismogramCanvas ? seismogramCanvas.getContext('2d') : null;

    this.rafId = null;
    this.lastTimestamp = 0;
  }

  startLoop(getStateFn) {
    if (this.rafId) return;
    this.lastTimestamp = performance.now();

    const step = (now) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      // حارس قفزات الزمن عند العودة من تبويب خامل (dt <= 0.05s)
      const clampedDt = Math.min(0.05, Math.max(0.001, rawDt));

      const state = getStateFn();
      if (state.simulation.status === 'running') {
        this.onTickCallback(clampedDt * 2.2); // تسريع زمن العرض التربوي 2.2x لوضوح الموجات
        const updatedState = getStateFn();
        this.renderAll(updatedState.simulation);
        if (updatedState.simulation.status === 'running') {
          this.rafId = requestAnimationFrame(step);
        } else {
          this.rafId = null;
        }
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(step);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderAll(simState) {
    try {
      this.renderGeologicalCrossSection(simState);
      this.renderSeismogramTrace(simState);
    } catch (_err) {
      // حماية الرسم من أي استثناء رسومي غير متوقع
    }
  }

  renderGeologicalCrossSection(sim) {
    const ctx = this.simCtx;
    if (!ctx || !this.simCanvas) return;

    const W = this.simCanvas.width;
    const H = this.simCanvas.height;
    const surfaceY = 108;

    ctx.clearRect(0, 0, W, H);

    // 1. السماء
    const skyGrad = ctx.createLinearGradient(0, 0, 0, surfaceY);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, surfaceY);

    // 2. طبقات القشرة الأرضية والرداء
    const crustGrad = ctx.createLinearGradient(0, surfaceY, 0, H);
    crustGrad.addColorStop(0, '#44403c');
    crustGrad.addColorStop(0.55, '#292524');
    crustGrad.addColorStop(1, '#1c1917');
    ctx.fillStyle = crustGrad;
    ctx.fillRect(0, surfaceY, W, H - surfaceY);

    // خط السطح الأخضر
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, surfaceY - 5, W, 6);

    // خطوط الطبقات الجيولوجية
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    [180, 260, 340].forEach((layerY) => {
      ctx.beginPath();
      ctx.moveTo(0, layerY);
      ctx.lineTo(W, layerY);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // إحداثيات المركز السطحي E والبؤرة F والمحطة S
    const epicenterX = 240;
    // تحويل العمق (2..300 كم) إلى إحداثي عمودي داخل المقطع
    const depthRatio = Math.min(1, Math.max(0.05, (sim.depthKm - 2) / 298));
    const hypocenterY = surfaceY + 34 + depthRatio * (H - surfaceY - 68);

    // تحويل المسافة السطحية (10..500 كم) إلى إحداثي أفقي للمحطة S
    const distRatio = Math.min(1, Math.max(0.06, sim.stationDistKm / 500));
    const stationX = epicenterX + 75 + distRatio * (W - epicenterX - 135);
    const pxPerKm = (stationX - epicenterX) / Math.max(1, sim.stationDistKm);

    // 3. رسم خط الفالق الزلزالي وإزاحته حسب نوع الفالق
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    const faultSlope = sim.faultType === 'normal' ? 42 : sim.faultType === 'reverse' ? -42 : 0;
    ctx.moveTo(epicenterX - faultSlope, surfaceY);
    ctx.lineTo(epicenterX + faultSlope, H - 15);
    ctx.stroke();
    ctx.restore();

    // 4. حساب المسافات والأزمنة الفيزيائية
    const hypoDistKm = Math.sqrt(sim.stationDistKm * sim.stationDistKm + sim.depthKm * sim.depthKm);
    const vlKmS = 2.8; // سرعة الموجات السطحية L
    const tEpicenterSec = sim.depthKm / sim.vpKmS;

    // 5. رسم جبهات الأمواج الزلزالية المنتشرة (إذا كانت المحاكاة جارية أو متوقفة بعد الانطلاق)
    const elapsed = sim.elapsedSec;
    if (elapsed > 0) {
      const pRadiusPx = elapsed * sim.vpKmS * pxPerKm;
      const sRadiusPx = elapsed * sim.vsKmS * pxPerKm;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, surfaceY, W, H - surfaceY);
      ctx.clip();

      // موجة P الأولية (زرقاء تضاغطية - 3 حلقات متحدة المركز)
      for (let ring = 0; ring < 3; ring++) {
        const r = pRadiusPx - ring * 18;
        if (r > 4) {
          ctx.beginPath();
          ctx.arc(epicenterX, hypocenterY, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${0.85 - ring * 0.25})`;
          ctx.lineWidth = 3 - ring * 0.7;
          ctx.stroke();
        }
      }

      // موجة S الثانوية (كهرمانية قصية)
      for (let ring = 0; ring < 3; ring++) {
        const r = sRadiusPx - ring * 15;
        if (r > 4) {
          ctx.beginPath();
          ctx.arc(epicenterX, hypocenterY, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.9 - ring * 0.25})`;
          ctx.lineWidth = 3.5 - ring * 0.8;
          ctx.stroke();
        }
      }
      ctx.restore();

      // الموجات السطحية L (تنتشر أفقياً على السطح بعد وصول الموجة للمركز السطحي)
      if (elapsed > tEpicenterSec) {
        const lDistPx = (elapsed - tEpicenterSec) * vlKmS * pxPerKm;
        ctx.save();
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const minX = Math.max(10, epicenterX - lDistPx);
        const maxX = Math.min(W - 10, epicenterX + lDistPx);
        for (let x = minX; x <= maxX; x += 4) {
          const distFromE = Math.abs(x - epicenterX);
          const attenuation = Math.max(0.15, 1 - distFromE / (W * 0.8));
          const amp = Math.min(14, (sim.magnitude - 1.5) * 2.2) * attenuation;
          const y = surfaceY - 3 + Math.sin(x * 0.18 - elapsed * 14) * amp;
          if (x === minX) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. رسم المثلث الهندسي الزلزالي (F - E - S)
    ctx.save();
    // العمق الشاقولي h
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(epicenterX, surfaceY);
    ctx.lineTo(epicenterX, hypocenterY);
    ctx.stroke();

    // الشعاع الزلزالي d_hypo نحو محطة الرصد S
    ctx.strokeStyle = '#a78bfa';
    ctx.beginPath();
    ctx.moveTo(epicenterX, hypocenterY);
    ctx.lineTo(stationX, surfaceY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 7. رسم المباني على السطح مع اهتزاز حي حسب الشدة المحلية
    const profile = calculateIntensityProfile(sim.magnitude, sim.depthKm, sim.stationDistKm);
    const buildingPositions = [
      { x: epicenterX - 38, h: 44, w: 24, distKm: 4 },
      { x: epicenterX + 14, h: 54, w: 26, distKm: 2 },
      { x: epicenterX + 115, h: 40, w: 22, distKm: Math.max(15, sim.stationDistKm * 0.4) },
      { x: stationX - 42, h: 36, w: 22, distKm: sim.stationDistKm }
    ];

    buildingPositions.forEach((b) => {
      const localHypoKm = Math.sqrt(b.distKm * b.distKm + sim.depthKm * sim.depthKm);
      const tArrivalP = localHypoKm / sim.vpKmS;
      const tArrivalS = localHypoKm / sim.vsKmS;
      let shakeOffset = 0;

      if (elapsed >= tArrivalP && sim.status === 'running') {
        const localInt = calculateIntensityProfile(sim.magnitude, sim.depthKm, b.distKm).stationIntensity;
        const factor = elapsed >= tArrivalS ? 1.0 : 0.35;
        shakeOffset = Math.sin(elapsed * 28 + b.x) * (localInt * 0.65) * factor;
      }

      ctx.save();
      ctx.translate(b.x + shakeOffset, surfaceY - b.h - 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, b.w, b.h);
      ctx.strokeRect(0, 0, b.w, b.h);

      // نوافذ المبنى
      ctx.fillStyle = '#38bdf8';
      for (let wy = 6; wy < b.h - 8; wy += 10) {
        ctx.fillRect(4, wy, 5, 6);
        ctx.fillRect(b.w - 9, wy, 5, 6);
      }
      ctx.restore();
    });

    // 8. رسم محطة الرصد الزلزالي S
    ctx.save();
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stationX, surfaceY - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // برج هوائي المحطة
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(stationX, surfaceY - 12);
    ctx.lineTo(stationX, surfaceY - 34);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(stationX, surfaceY - 36, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 9. رسم المركز السطحي E والبؤرة F
    ctx.save();
    // المركز السطحي E
    ctx.fillStyle = '#e11d48';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(epicenterX, surfaceY - 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // البؤرة F
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(epicenterX, hypocenterY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // التسميات التوضيحية العربية على Canvas
    ctx.font = 'bold 13px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = '#ffffff';
    ctx.fillText('E', epicenterX, surfaceY + 2);
    ctx.fillText('F', epicenterX, hypocenterY + 4);

    ctx.fillStyle = '#fda4af';
    ctx.fillText(`المركز السطحي E (I₀ = ${profile.romanI0})`, epicenterX, 26);

    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`محطة الرصد S (x = ${sim.stationDistKm} كم)`, stationX, 26);

    ctx.fillStyle = '#fde047';
    ctx.fillText(`البؤرة F (العمق h = ${sim.depthKm} كم)`, epicenterX - 95, hypocenterY + 4);

    ctx.fillStyle = '#ddd6fe';
    ctx.fillText(
      `الشعاع الزلزالي d = ${hypoDistKm.toFixed(1)} كم`,
      (epicenterX + stationX) / 2 + 25,
      (hypocenterY + surfaceY) / 2 + 12
    );

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`الزمن الزلزالي: t = ${elapsed.toFixed(1)} s`, 16, H - 14);
    ctx.restore();
  }

  renderSeismogramTrace(sim) {
    const ctx = this.seismoCtx;
    if (!ctx || !this.seismoCanvas) return;

    const W = this.seismoCanvas.width;
    const H = this.seismoCanvas.height;
    const midY = H / 2 + 6;

    ctx.clearRect(0, 0, W, H);

    // خلفية شبكة السيزموغرام
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 30; y < H; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // خط الصفر المرجعي
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    // حساب أزمنة وصول الموجات P, S, L إلى المحطة S
    const hypoDistKm = Math.sqrt(sim.stationDistKm * sim.stationDistKm + sim.depthKm * sim.depthKm);
    const tP = hypoDistKm / sim.vpKmS;
    const tS = hypoDistKm / sim.vsKmS;
    const tL = tS + Math.max(2.5, sim.stationDistKm / 18);
    const deltaT = tS - tP;

    const maxTimeWindow = Math.max(45, tL + 16);
    const timeToX = (t) => 45 + (t / maxTimeWindow) * (W - 75);

    // رسم معالم الأزمنة الرأسية (t0, tP, tS, tL)
    const markers = [
      { t: 0, label: 't₀ (الحدوث)', color: '#94a3b8' },
      { t: tP, label: `tP (${tP.toFixed(1)}s)`, color: '#38bdf8' },
      { t: tS, label: `tS (${tS.toFixed(1)}s)`, color: '#fbbf24' },
      { t: tL, label: 'موجات L السطحية', color: '#f87171' }
    ];

    markers.forEach((m) => {
      const mx = timeToX(m.t);
      if (mx >= 40 && mx <= W - 15) {
        ctx.save();
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, 22);
        ctx.lineTo(mx, H - 18);
        ctx.stroke();

        ctx.fillStyle = m.color;
        ctx.font = 'bold 11.5px "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(m.label, mx, 16);
        ctx.restore();
      }
    });

    // رسم قوس فارق الزمن Δt = tS - tP
    const xP = timeToX(tP);
    const xS = timeToX(tS);
    if (xS > xP + 16 && xS < W - 15) {
      ctx.save();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xP, H - 12);
      ctx.lineTo(xS, H - 12);
      ctx.stroke();
      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Δt = ${deltaT.toFixed(2)} s`, (xP + xS) / 2, H - 17);
      ctx.restore();
    }

    // رسم منحنى السيزموغرام حتى اللحظة الحالية (أو كاملاً في وضع الخمول كمعاينة علمية)
    const renderUpToSec = sim.status === 'idle' && sim.elapsedSec === 0 ? maxTimeWindow : sim.elapsedSec;
    const baseAmp = Math.min(62, Math.max(8, (sim.magnitude - 1.5) * 8.5));

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = sim.status === 'idle' ? 'rgba(56, 189, 248, 0.55)' : '#38bdf8';
    ctx.beginPath();

    const maxPlotX = timeToX(Math.min(maxTimeWindow, renderUpToSec));
    for (let px = 45; px <= maxPlotX; px += 2) {
      const t = ((px - 45) / (W - 75)) * maxTimeWindow;
      let dy = (Math.sin(t * 19) + Math.cos(t * 31)) * 0.45; // ضجيج الخلفية الميكروسيزمي

      if (t >= tP && t < tS) {
        // موجة P الأولية: تردد عالٍ وسعة متوسطة
        const envP = Math.exp(-(t - tP) * 0.22);
        dy += Math.sin((t - tP) * 32) * (baseAmp * 0.28) * envP;
      } else if (t >= tS && t < tL) {
        // موجة S الثانوية: تردد متوسط وسعة أكبر
        const envS = Math.exp(-(t - tS) * 0.18);
        dy += Math.sin((t - tS) * 21) * (baseAmp * 0.56) * envS;
      } else if (t >= tL) {
        // موجات L السطحية: سعة عظمى وتردد منخفض
        const envL = Math.exp(-(t - tL) * 0.14);
        dy += Math.sin((t - tL) * 12) * baseAmp * envL;
      }

      const y = Math.min(H - 8, Math.max(24, midY + dy));
      if (px === 45) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();

    // رأس قلم التسجيل الحي
    if (sim.status !== 'idle') {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(maxPlotX, midY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
