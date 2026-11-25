// 직접 실험하는 시뮬레이터 6종.
// 모든 수치는 교육용 추정값이며 실제 엔지니어링 설계, CFD 해석, 견적을 대체하지 않는다.
// 입력값은 전부 "가상 입력값"이다(제조사 사양이 아님). 계산 기준:
//   IT 전력 부하 = 서버 수량 × 서버당 소비전력 / 발열량 ≈ 소비전력(정상상태)
//   PUE = 전체 시설 소비전력 ÷ IT 장비 소비전력 / 냉각용량과 냉각 전력 소비량은 다른 값
//   냉각수 유량 = 열량 ÷ (밀도 × 비열 × ΔT)   (물: 밀도 약 1 kg/L, 비열 약 4.18 kJ/kg·K)
const T = (ko, en) => ({ ko, en });
const fmt = (v, d = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

const NOTE = T('모든 수치는 교육용 추정값입니다. 실제 설계·CFD 해석·견적을 대체하지 않으며, 입력값은 제조사 사양이 아닌 가상 값입니다.',
  'All figures are educational estimates. They do not replace real design, CFD analysis or quotations, and inputs are virtual values, not manufacturer specs.');

function slider(id, label, min, max, step, val, unit) {
  return `<div class="sim-row"><label>${label}<b id="${id}-v">${val}</b>${unit}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
}
function metric(label, id, cls = '') { return `<div class="sim-m ${cls}"><span>${label}</span><b id="${id}">-</b></div>`; }

export const SIMS = {
  // ------------------------------------------------------------ 실험 1
  'gpu-add': {
    icon: '🧪', title: T('실험 1. GPU 서버를 추가하면?', 'Experiment 1. What if we add GPU servers?'),
    render(el, L, done) {
      el.innerHTML = `<p class="sim-d">${L(T('랙에 GPU 서버를 한 대씩 추가해 보세요. 전기와 열이 어떻게 늘어나는지, 냉각이 언제 모자라는지 볼 수 있어요.', 'Add GPU servers to the rack one by one and watch power and heat grow, and when cooling runs out.'))}</p>
        <div class="sim-grid"><div>
        ${slider('s-n', L(T('GPU 서버 수량 ', 'GPU servers ')), 0, 10, 1, 2, L(T('대', '')))}
        ${slider('s-p', L(T('서버당 소비전력(가상) ', 'Power per server (virtual) ')), 4, 14, 1, 10, 'kW')}
        ${slider('s-c', L(T('이 랙에 공급되는 냉각용량(가상) ', 'Cooling capacity for this rack (virtual) ')), 10, 140, 5, 40, 'kW')}
        <div class="sim-rack" id="s-rack"></div></div><div>
        ${metric(L(T('GPU 수량 (서버당 8개 가정)', 'GPUs (8 per server assumed)')), 'm-gpu')}${metric(L(T('IT 전력 부하', 'IT power load')), 'm-it')}
        ${metric(L(T('예상 발열량 (≈ 소비전력)', 'Heat output (≈ power draw)')), 'm-heat')}${metric(L(T('랙당 전력 밀도', 'Power density per rack')), 'm-den')}
        ${metric(L(T('냉각설비 필요 용량', 'Cooling capacity needed')), 'm-need')}${metric(L(T('냉각용량 여유', 'Cooling headroom')), 'm-room')}
        <div class="sim-temp"><i id="s-temp"></i><span id="s-tl"></span></div><p class="sim-msg" id="s-msg"></p></div></div>`;
      let touched = false;
      const upd = () => {
        const n = +el.querySelector('#s-n').value, p = +el.querySelector('#s-p').value, c = +el.querySelector('#s-c').value;
        el.querySelector('#s-n-v').textContent = n; el.querySelector('#s-p-v').textContent = p; el.querySelector('#s-c-v').textContent = c;
        const it = n * p, room = c - it;
        el.querySelector('#m-gpu').textContent = fmt(n * 8); el.querySelector('#m-it').textContent = fmt(it) + ' kW';
        el.querySelector('#m-heat').textContent = fmt(it) + ' kW'; el.querySelector('#m-den').textContent = fmt(it) + ' kW/rack';
        el.querySelector('#m-need').textContent = fmt(it) + ' kW';
        const r = el.querySelector('#m-room'); r.textContent = (room >= 0 ? '+' : '') + fmt(room) + ' kW'; r.parentElement.classList.toggle('bad', room < 0);
        el.querySelector('#s-rack').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
        const over = Math.max(0, -room) / Math.max(c, 1); const temp = 27 + Math.min(1, over) * 45 + (it > 0 ? Math.min(8, it / c * 8) : 0);
        const bar = el.querySelector('#s-temp'); bar.style.width = Math.min(100, (temp - 18) / 60 * 100) + '%'; bar.style.background = temp > 45 ? '#ff5252' : temp > 35 ? '#ffb13d' : '#4dff8a';
        el.querySelector('#s-tl').textContent = L(T('서버 흡기 온도(교육용 표현) 약 ', 'Server inlet temperature (illustrative) about ')) + fmt(temp) + '℃';
        el.querySelector('#s-msg').textContent = room < 0
          ? L(T('냉각용량이 부족합니다. 온도가 올라 서버가 스스로 속도를 낮추거나 멈출 수 있어요. 냉각을 늘리거나, 공랭 한계를 넘는 밀도라면 액체냉각을 검토합니다.', 'Cooling is insufficient. Temperature rises and servers may throttle or stop. Add cooling, or consider liquid cooling if density exceeds what air can handle.'))
          : it >= 40 ? L(T('랙당 40kW를 넘으면 공기만으로 식히기가 매우 어려워집니다. 이 구간부터 액체냉각이 현실적인 선택이 됩니다.', 'Above about 40 kW per rack, air cooling becomes very difficult and liquid cooling becomes the practical choice.'))
            : L(T('냉각용량이 충분합니다.', 'Cooling capacity is sufficient.'));
        if (touched && n >= 5) done();
      };
      el.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => { touched = true; upd(); })); upd();
    },
  },
  // ------------------------------------------------------------ 실험 2
  'air-vs-liquid': {
    icon: '⚖️', title: T('실험 2. 공랭식과 액체냉각 비교', 'Experiment 2. Air cooling vs liquid cooling'),
    render(el, L, done) {
      el.innerHTML = `<p class="sim-d">${L(T('같은 IT 부하(1,000kW)를 두 방식으로 식힐 때의 차이입니다. 랙당 전력 밀도를 바꿔 보세요.', 'The same IT load (1,000 kW) cooled two ways. Change the power density per rack.'))}</p>
        ${slider('s-d', L(T('랙당 전력 밀도(가상) ', 'Power density per rack (virtual) ')), 5, 130, 5, 40, 'kW')}
        ${slider('s-cap', L(T('액체냉각이 물로 가져가는 열의 비율(가상) ', 'Share of heat captured by liquid (virtual) ')), 60, 95, 5, 80, '%')}
        <table class="sim-t"><thead><tr><th></th><th>${L(T('공랭식', 'Air cooling'))}</th><th>${L(T('액체냉각 (DLC)', 'Liquid cooling (DLC)'))}</th></tr></thead><tbody id="s-tb"></tbody></table><p class="sim-msg" id="s-msg"></p>`;
      let moves = 0;
      const upd = () => {
        const d = +el.querySelector('#s-d').value, cap = +el.querySelector('#s-cap').value / 100;
        el.querySelector('#s-d-v').textContent = d; el.querySelector('#s-cap-v').textContent = Math.round(cap * 100);
        const IT = 1000; const airMax = 25;                    // 가상 기준: 공랭 랙 한계 약 25kW
        const airRack = Math.min(d, airMax), airRacks = Math.ceil(IT / airRack), liqRacks = Math.ceil(IT / d);
        const airCoolKw = IT * (0.28 + Math.max(0, airRack - 15) * 0.006), liqCoolKw = IT * cap * 0.07 + IT * (1 - cap) * 0.30;
        const other = IT * 0.08;                               // 전력 손실·조명 등(가상)
        const rows = [
          [L(T('냉각 방식', 'Method')), L(T('찬 공기를 불어 식힘', 'Blows cold air')), L(T('칩에 냉각수를 직접 보냄', 'Sends coolant to the chips'))],
          [L(T('랙당 전력 밀도', 'Density per rack')), fmt(airRack) + ' kW' + (d > airMax ? L(T(' (한계)', ' (limit)')) : ''), fmt(d) + ' kW'],
          [L(T('필요한 랙 수', 'Racks needed')), fmt(airRacks), fmt(liqRacks)],
          [L(T('냉각에 필요한 공간(랙 자리 기준)', 'Space needed (rack positions)')), fmt(airRacks * 2.6) + ' ㎡', fmt(liqRacks * 2.6 + 12) + ' ㎡'],
          [L(T('냉각 전력 소비 예시', 'Cooling power example')), fmt(airCoolKw) + ' kW', fmt(liqCoolKw) + ' kW'],
          [L(T('PUE 예시', 'PUE example')), fmt((IT + airCoolKw + other) / IT, 2), fmt((IT + liqCoolKw + other) / IT, 2)],
          [L(T('잔여 공랭 부하', 'Residual air load')), fmt(IT) + ' kW', fmt(IT * (1 - cap)) + ' kW'],
          [L(T('유지보수', 'Maintenance')), L(T('익숙하고 단순함. 필터·팬 점검', 'Familiar and simple; filters and fans')), L(T('누설 점검, 냉각수 수질 관리, 전문 인력 필요', 'Leak checks, coolant quality, trained staff'))],
        ];
        el.querySelector('#s-tb').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
        el.querySelector('#s-msg').textContent = d <= 20
          ? L(T('이 밀도에서는 공랭식으로 충분합니다. 배관 공사와 누설 관리 부담이 없는 공랭식이 더 단순하고 경제적일 수 있어요.', 'At this density air cooling is enough, and without piping or leak management it can be simpler and cheaper.'))
          : d <= 45 ? L(T('경계 구간입니다. 인로우 냉방 같은 고밀도 공랭이나 액체냉각 중에서 건물 조건을 보고 고릅니다.', 'A borderline range. Choose between high-density air (such as in-row) and liquid cooling based on the building.'))
            : L(T('이 밀도는 공기만으로 식히기 어렵습니다. 공랭식은 랙을 훨씬 많이 나눠 놓아야 하고, 액체냉각이 사실상 필요합니다.', 'This density is hard to cool with air alone. Air needs far more racks, and liquid cooling is effectively required.'));
        if (++moves > 4) done();
      };
      el.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd)); upd();
    },
  },
  // ------------------------------------------------------------ 실험 3
  'delta-t': {
    icon: '🌡️', title: T('실험 3. 냉각수 온도 차이 (ΔT)', 'Experiment 3. Coolant temperature difference (ΔT)'),
    render(el, L, done) {
      el.innerHTML = `<p class="sim-d">${L(T('ΔT는 냉각수가 들어갈 때(공급)와 나올 때(환수)의 온도 차이입니다. 같은 열을 옮겨도 ΔT가 크면 물이 덜 필요해요.', 'ΔT is the difference between supply and return coolant temperature. For the same heat, a larger ΔT needs less water.'))}</p>
        ${slider('s-q', L(T('제거할 열량(가상) ', 'Heat to remove (virtual) ')), 50, 1000, 50, 250, 'kW')}
        ${slider('s-ts', L(T('공급 온도 ', 'Supply temperature ')), 20, 45, 1, 32, '℃')}
        ${slider('s-dt', 'ΔT ', 3, 15, 1, 8, 'K')}
        <div class="sim-pipe"><div class="p s"><i id="s-ps"></i><span id="s-ls"></span></div><div class="p r"><i id="s-pr"></i><span id="s-lr"></span></div></div>
        <div class="sim-grid">${metric(L(T('필요 유량', 'Required flow')), 'm-f')}${metric(L(T('환수 온도', 'Return temperature')), 'm-tr')}</div><p class="sim-msg" id="s-msg"></p>`;
      let moves = 0;
      const upd = () => {
        const q = +el.querySelector('#s-q').value, ts = +el.querySelector('#s-ts').value, dt = +el.querySelector('#s-dt').value;
        el.querySelector('#s-q-v').textContent = q; el.querySelector('#s-ts-v').textContent = ts; el.querySelector('#s-dt-v').textContent = dt;
        const lpm = q / (4.18 * dt) * 60;                      // kW ÷ (kJ/kg·K × K) = kg/s → L/min
        el.querySelector('#m-f').textContent = fmt(lpm) + ' L/min'; el.querySelector('#m-tr').textContent = fmt(ts + dt) + ' ℃';
        const w = Math.max(8, Math.min(100, lpm / 48)); const sp = Math.max(0.35, 18 / Math.sqrt(lpm));
        for (const [id, lab, tt] of [['#s-ps', '#s-ls', ts], ['#s-pr', '#s-lr', ts + dt]]) {
          const b = el.querySelector(id); b.style.height = w * 0.5 + 6 + 'px'; b.style.animationDuration = sp + 's';
          el.querySelector(lab).textContent = (id === '#s-ps' ? L(T('공급 ', 'Supply ')) : L(T('환수 ', 'Return '))) + fmt(tt) + '℃';
        }
        el.querySelector('#s-msg').textContent = dt <= 5
          ? L(T('ΔT가 작으면 물을 많이 돌려야 합니다. 배관이 굵어지고 펌프가 전기를 더 씁니다.', 'With a small ΔT, a lot of water must circulate: bigger pipes and more pump power.'))
          : dt >= 12 ? L(T('ΔT가 크면 유량은 줄지만 환수 온도가 높아집니다. 서버가 허용하는 온도 범위를 넘지 않는지 확인해야 합니다.', 'A large ΔT cuts flow but raises the return temperature; check it stays within what the servers allow.'))
            : L(T('유량 = 열량 ÷ (밀도 × 비열 × ΔT). ΔT를 두 배로 하면 유량은 절반이 됩니다.', 'Flow = heat ÷ (density × specific heat × ΔT). Doubling ΔT halves the flow.'));
        if (++moves > 4) done();
      };
      el.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd)); upd();
    },
  },
  // ------------------------------------------------------------ 실험 4
  'failure': {
    icon: '🚨', title: T('실험 4. 데이터센터 장애 대응', 'Experiment 4. Responding to failures'),
    render(el, L, done) {
      const SC = [
        ['cool', T('냉각설비 한 대 정지', 'One cooling unit stops'), T('예비 냉각기(N+1)가 자동으로 가동', 'The spare cooling unit (N+1) starts automatically')],
        ['pump', T('CDU 펌프 장애', 'CDU pump failure'), T('CDU 안의 예비 펌프가 즉시 이어받음', 'The standby pump inside the CDU takes over at once')],
        ['power', T('전력 공급 장애', 'Power supply failure'), T('UPS가 받치고 비상발전기가 기동, B 계통 전원이 유지', 'UPS holds while generators start; the B power path stays up')],
        ['flow', T('냉각수 유량 부족', 'Low coolant flow'), T('예비 펌프 가동, 밸브 개도 조정으로 유량 회복', 'Standby pump and valve adjustment restore the flow')],
        ['temp', T('서버 온도 상승', 'Server temperature rise'), T('센서 경보 → 냉각 출력 상향, 예비 설비 투입', 'Sensor alarm → more cooling output and standby units')],
      ];
      el.innerHTML = `<p class="sim-d">${L(T('장애를 하나 고르고, 이중화 설비가 있을 때와 없을 때를 비교해 보세요.', 'Pick a failure and compare what happens with and without redundant equipment.'))}</p>
        <div class="sim-btns" id="s-sc">${SC.map((s, i) => `<button data-i="${i}">${L(s[1])}</button>`).join('')}</div>
        <div class="sim-btns"><button id="s-r1" class="on">${L(T('이중화 있음 (N+1)', 'With redundancy (N+1)'))}</button><button id="s-r0">${L(T('이중화 없음 (N)', 'No redundancy (N)'))}</button></div>
        <div class="sim-temp big"><i id="s-temp"></i><span id="s-tl"></span></div><p class="sim-msg" id="s-msg">${L(T('위에서 장애를 선택하세요.', 'Choose a failure above.'))}</p>`;
      let red = true, cur = -1, timer = null; const seen = new Set();
      const run = () => {
        if (cur < 0) return; clearInterval(timer); let t = 0, temp = 27;
        const bar = el.querySelector('#s-temp'), msg = el.querySelector('#s-msg'), tl = el.querySelector('#s-tl');
        timer = setInterval(() => {
          if (!el.isConnected) return clearInterval(timer);
          t += 0.2;
          if (red) temp = t < 1.5 ? 27 + t * 4 : Math.max(28, 33 - (t - 1.5) * 2.5); else temp = Math.min(70, 27 + t * 5.5);
          bar.style.width = Math.min(100, (temp - 18) / 55 * 100) + '%'; bar.style.background = temp > 50 ? '#ff5252' : temp > 36 ? '#ffb13d' : '#4dff8a';
          tl.textContent = L(T('서버 온도(교육용 표현) 약 ', 'Server temperature (illustrative) about ')) + fmt(temp) + '℃';
          msg.textContent = red
            ? (t < 1.5 ? L(T('장애 발생! 온도가 잠깐 오릅니다…', 'Failure! Temperature rises briefly…')) : '✅ ' + L(SC[cur][2]) + L(T('. 서비스는 멈추지 않습니다.', '. Service keeps running.')))
            : (temp < 45 ? L(T('장애 발생! 대신 맡아 줄 설비가 없습니다…', 'Failure! Nothing can take over…')) : temp < 65 ? '⚠️ ' + L(T('서버가 스스로 속도를 낮춥니다(성능 저하).', 'Servers throttle themselves (reduced performance).')) : '⛔ ' + L(T('과열로 서버가 정지했습니다. 서비스 중단!', 'Servers shut down from overheating. Service outage!')));
          if (t > 9) clearInterval(timer);
        }, 100);
        seen.add(cur + (red ? 'r' : 'n')); if (seen.has(cur + 'r') && seen.has(cur + 'n')) done();
      };
      el.querySelector('#s-sc').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cur = +b.dataset.i; el.querySelectorAll('#s-sc button').forEach((x) => x.classList.toggle('on', x === b)); run(); });
      el.querySelector('#s-r1').addEventListener('click', () => { red = true; el.querySelector('#s-r1').classList.add('on'); el.querySelector('#s-r0').classList.remove('on'); run(); });
      el.querySelector('#s-r0').addEventListener('click', () => { red = false; el.querySelector('#s-r0').classList.add('on'); el.querySelector('#s-r1').classList.remove('on'); run(); });
    },
  },
  // ------------------------------------------------------------ LEVEL 6 설계 미션
  'design': {
    icon: '📐', title: T('미래형 데이터센터 설계 미션', 'Future data center design mission'),
    render(el, L, done) {
      const Q = [
        ['w', T('1. 어떤 일을 할 데이터센터인가요?', '1. What will it be used for?'), [['biz', T('일반 업무·웹', 'Business and web')], ['inf', T('AI 추론', 'AI inference')], ['train', T('대규모 AI 학습', 'Large-scale AI training')]]],
        ['d', T('2. 랙당 전력 밀도는?', '2. Power density per rack?'), [['10', T('약 10kW', 'About 10 kW')], ['40', T('약 40kW', 'About 40 kW')], ['130', T('약 130kW', 'About 130 kW')]]],
        ['c', T('3. 서버를 어떻게 식힐까요?', '3. How will servers be cooled?'), [['air', T('공랭 (CRAH·FWU)', 'Air (CRAH, FWU)')], ['inrow', T('고밀도 공랭 (In-row)', 'High-density air (in-row)')], ['dlc', T('액체냉각 (DLC + CDU)', 'Liquid (DLC + CDU)')]]],
        ['h', T('4. 열을 건물 밖으로 어떻게 내보낼까요?', '4. How will heat be rejected outdoors?'), [['chiller', T('Chiller 중심', 'Chiller based')], ['dry', T('Dry Cooler 중심', 'Dry cooler based')], ['mix', T('Dry Cooler + Chiller 보조', 'Dry cooler + chiller assist')]]],
      ];
      const pick = {};
      el.innerHTML = `<p class="sim-d">${L(T('전체 전력 규모만으로 정답이 정해지지 않습니다. 하는 일과 랙당 발열에 맞춰 골라 보세요.', 'Total power alone does not decide the answer. Choose to fit the workload and heat per rack.'))}</p>
        ${Q.map((q) => `<div class="sim-q"><h4>${L(q[1])}</h4><div class="sim-btns" data-k="${q[0]}">${q[2].map((o) => `<button data-v="${o[0]}">${L(o[1])}</button>`).join('')}</div></div>`).join('')}
        <p class="sim-msg" id="s-msg"></p>`;
      const judge = () => {
        const m = el.querySelector('#s-msg'); if (Object.keys(pick).length < 4) { m.textContent = L(T('네 가지를 모두 골라 주세요.', 'Please choose all four.')); return; }
        const d = +pick.d; const notes = []; let ok = true;
        if (pick.w === 'train' && d < 40) { notes.push(L(T('대규모 AI 학습은 GPU를 빽빽하게 모아야 해서 랙당 밀도가 훨씬 높아집니다.', 'Large-scale AI training packs GPUs densely, so rack density is much higher.'))); ok = false; }
        if (pick.w === 'biz' && d > 40) { notes.push(L(T('일반 업무용 서버는 이렇게 높은 밀도가 필요하지 않습니다. 설비가 과해집니다.', 'Business servers do not need such density; the facility would be oversized.'))); ok = false; }
        if (d >= 130 && pick.c !== 'dlc') { notes.push(L(T('랙당 130kW는 공기로 식힐 수 없습니다. 액체냉각이 필요합니다.', '130 kW per rack cannot be air cooled. Liquid cooling is needed.'))); ok = false; }
        if (d === 40 && pick.c === 'air') { notes.push(L(T('랙당 40kW는 일반 공랭으로는 벅찹니다. In-row나 액체냉각을 검토하세요.', '40 kW per rack is a stretch for ordinary air cooling. Consider in-row or liquid.'))); ok = false; }
        if (d <= 10 && pick.c === 'dlc') notes.push(L(T('가능하지만, 이 밀도에서는 공랭식이 더 단순하고 경제적입니다.', 'Possible, but at this density air cooling is simpler and cheaper.')));
        if (pick.c === 'dlc' && pick.h !== 'chiller') notes.push(L(T('좋은 조합입니다. 액체냉각은 비교적 따뜻한 물로도 식힐 수 있어 Dry Cooler와 잘 맞습니다.', 'A good match: liquid cooling works with fairly warm water, which suits dry coolers.')));
        if (pick.c !== 'dlc' && pick.h === 'dry') notes.push(L(T('공랭식은 더 차가운 물이 필요해 더운 날에는 Chiller 보조가 필요할 수 있습니다.', 'Air cooling needs colder water, so chiller assistance may be required on hot days.')));
        m.innerHTML = (ok ? '✅ ' + L(T('잘 맞는 구성입니다!', 'This configuration fits well!')) : '🤔 ' + L(T('다시 생각해 볼 점이 있어요.', 'Something to reconsider.'))) + (notes.length ? '<br>' + notes.join('<br>') : '');
        if (ok) done();
      };
      el.querySelectorAll('.sim-btns[data-k]').forEach((g) => g.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pick[g.dataset.k] = b.dataset.v; g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); judge(); }));
    },
  },
  'efficiency': {
    icon: '📊', title: T('에너지 효율 개선 방법 선택하기', 'Choose ways to improve energy efficiency'),
    render(el, L, done) {
      const O = [
        [0.10, T('통로 밀폐(Containment)로 찬 공기와 더운 공기 분리', 'Containment to separate cold and hot air'), T('현재 상용화', 'Available today')],
        [0.08, T('냉각수·공기 공급 온도 높이기', 'Raise supply water and air temperatures'), T('현재 상용화', 'Available today')],
        [0.12, T('Dry Cooler로 바깥 공기 냉각(프리쿨링) 활용', 'Use outdoor air cooling (free cooling) with dry coolers'), T('현재 상용화', 'Available today')],
        [0.15, T('액체냉각(DLC) 적용으로 팬·냉동기 부담 줄이기', 'Apply liquid cooling (DLC) to cut fan and chiller load'), T('현재 상용화', 'Available today')],
        [0.04, T('펌프·팬을 필요한 만큼만 돌리는 가변속 제어', 'Variable-speed control for pumps and fans'), T('현재 상용화', 'Available today')],
        [0.03, T('AI가 스스로 최적 운전을 찾는 자동 제어', 'AI-driven automatic optimization'), T('미래 콘셉트', 'Future concept')],
      ];
      el.innerHTML = `<p class="sim-d">${L(T('기준 PUE 1.60(가상)에서 시작합니다. 개선 방법을 골라 PUE가 어떻게 달라지는지 보세요.', 'Start from a baseline PUE of 1.60 (virtual). Pick improvements and see how PUE changes.'))}</p>
        ${O.map((o, i) => `<label class="sim-chk"><input type="checkbox" data-i="${i}"><span>${L(o[1])}</span><em class="${i === 5 ? 'fut' : ''}">${L(o[2])}</em></label>`).join('')}
        <label class="sim-chk"><input type="checkbox" id="s-hr"><span>${L(T('폐열 회수 (버리는 열을 난방에 재사용)', 'Waste heat recovery (reuse rejected heat for heating)'))}</span><em>${L(T('일부 상용화', 'Partly available'))}</em></label>
        <div class="sim-grid">${metric(L(T('PUE 예시', 'PUE example')), 'm-pue')}${metric(L(T('IT 100MW일 때 전체 전력 예시', 'Total power example at 100 MW IT')), 'm-tot')}</div><p class="sim-msg" id="s-msg"></p>`;
      const upd = () => {
        let pue = 1.6, n = 0; el.querySelectorAll('input[data-i]').forEach((c) => { if (c.checked) { pue -= O[+c.dataset.i][0]; n++; } });
        pue = Math.max(1.08, pue); const hr = el.querySelector('#s-hr').checked;
        el.querySelector('#m-pue').textContent = fmt(pue, 2); el.querySelector('#m-tot').textContent = fmt(100 * pue, 0) + ' MW';
        el.querySelector('#s-msg').textContent = (hr ? L(T('폐열 회수는 PUE 숫자를 바꾸지는 않지만, 버리던 열을 다시 쓰므로 전체 에너지 활용이 좋아집니다. ', 'Heat recovery does not change PUE, but reusing rejected heat improves overall energy use. ')) : '')
          + L(T('PUE = 전체 시설 소비전력 ÷ IT 장비 소비전력. 절감 폭은 현장 조건에 따라 크게 달라집니다.', 'PUE = total facility power ÷ IT power. Actual savings vary greatly by site.'));
        if (n >= 3) done();
      };
      el.querySelectorAll('input').forEach((i) => i.addEventListener('change', upd)); upd();
    },
  },
};
export { NOTE as SIM_NOTE };
