// 데이터센터(레벨) 배치 데이터. 단위는 미터. x = 좌우, z = 앞뒤. 방 중심이 (0,0).
// items: { id, type(설비 모델), equip(equipment.js 키), pos:[x,z], rot(도, 0 = 앞면이 +z 방향) }
// flows: 시각화 모드에서 보여 줄 흐름 경로. pts 는 [x,y,z] 점 목록.
// missions: need 는 살펴봐야 하는 equip 키 목록(모두 살펴보면 완료).
import { MORE_LEVELS } from './levels_more.js';

const B = (ko, en) => ({ ko, en });

export const LEVELS = [
  {
    id: 'L1', ready: true, power: '50 kW', badge: '🖥️',
    name: B('소규모 서버실', 'Small Server Room'),
    desc: B('작은 회사의 업무 시스템과 웹서비스가 돌아가는 곳', 'Where a small company runs its business systems and web services'),
    title: 1,
    room: { w: 16, d: 12, h: 3.4 },
    spawn: [0, 4.2, 180],
    items: [
      { id: 'rack1', type: 'rack', variant: 'cpu1u', equip: 'server-1u', pos: [-2.7, -1.2], rot: 0 },
      { id: 'rack2', type: 'rack', variant: 'cpu2u', equip: 'server-2u', pos: [-0.9, -1.2], rot: 0 },
      { id: 'rack3', type: 'rack', variant: 'mixed', equip: 'rack-cpu', pos: [0.9, -1.2], rot: 0 },
      { id: 'rack4', type: 'rack', variant: 'network', equip: 'switch', pos: [2.7, -1.2], rot: 0 },
      { id: 'crac1', type: 'crac', equip: 'crac', pos: [-6.6, -1.2], rot: 90 },
      { id: 'ups1', type: 'ups', equip: 'ups', pos: [6.9, -3.6], rot: -90 },
      { id: 'pdu1', type: 'pdu', equip: 'pdu', pos: [6.9, -0.6], rot: -90 },
      { id: 'sensor1', type: 'sensor', equip: 'temp-sensor', pos: [4.3, 0.4], rot: 0 },
      { id: 'aik1', type: 'kiosk', equip: 'aik-point', pos: [-4.6, 3.6], rot: 20 },
      { id: 'exit', type: 'portal', pos: [7.8, 3.6], rot: -90 },
    ],
    flows: {
      air: [
        { color: 'cold', pts: [[-5.9, 0.5, -0.4], [-4.5, 0.5, 0.6], [-2.7, 0.6, 0.6], [-2.7, 1.0, -0.6]] },
        { color: 'cold', pts: [[-5.9, 0.5, -0.4], [-4.0, 0.5, 0.9], [-0.9, 0.6, 0.9], [-0.9, 1.0, -0.6]] },
        { color: 'cold', pts: [[-5.9, 0.5, -0.4], [-3.5, 0.5, 1.2], [0.9, 0.6, 1.2], [0.9, 1.0, -0.6]] },
        { color: 'cold', pts: [[-5.9, 0.5, -0.4], [-3.0, 0.5, 1.5], [2.7, 0.6, 1.5], [2.7, 1.0, -0.6]] },
        { color: 'hot', pts: [[2.7, 1.3, -1.9], [2.7, 2.4, -3.0], [-3.0, 2.7, -3.4], [-6.3, 2.5, -1.6]] },
        { color: 'hot', pts: [[0.9, 1.3, -1.9], [0.9, 2.3, -2.8], [-3.0, 2.6, -3.1], [-6.3, 2.5, -1.4]] },
        { color: 'hot', pts: [[-0.9, 1.3, -1.9], [-0.9, 2.2, -2.6], [-3.5, 2.5, -2.8], [-6.3, 2.5, -1.2]] },
        { color: 'hot', pts: [[-2.7, 1.3, -1.9], [-2.7, 2.1, -2.4], [-4.5, 2.4, -2.4], [-6.3, 2.5, -1.0]] },
      ],
      power: [
        { color: 'power', pts: [[7.6, 2.9, -5.6], [6.9, 2.9, -5.2], [6.9, 2.0, -3.6]] },
        { color: 'power', pts: [[6.9, 2.0, -3.6], [6.9, 2.9, -2.1], [6.9, 2.0, -0.6]] },
        { color: 'power', pts: [[6.9, 2.0, -0.6], [6.0, 2.9, -1.2], [2.7, 2.9, -1.2], [2.7, 2.1, -1.2]] },
        { color: 'power', pts: [[6.0, 2.9, -1.2], [0.9, 2.9, -1.2], [0.9, 2.1, -1.2]] },
        { color: 'power', pts: [[6.0, 2.9, -1.2], [-0.9, 2.9, -1.2], [-0.9, 2.1, -1.2]] },
        { color: 'power', pts: [[6.0, 2.9, -1.2], [-2.7, 2.9, -1.2], [-2.7, 2.1, -1.2]] },
      ],
      liquid: [],
    },
    heat: [
      { pos: [0, -1.2], size: [7.6, 1.2], t: 0.55 },
      { pos: [0, -2.6], size: [8.2, 1.4], t: 0.9 },
      { pos: [0, 0.6], size: [8.2, 1.6], t: 0.15 },
      { pos: [-6.4, -1.2], size: [1.2, 2.2], t: 0.05 },
    ],
    missions: [
      { id: 'L1-1', text: B('서버 랙 발견하기', 'Find a server rack'), need: ['rack-cpu'] },
      { id: 'L1-2', text: B('1U·2U 서버 살펴보기', 'Inspect the 1U and 2U servers'), need: ['server-1u', 'server-2u'] },
      { id: 'L1-3', text: B('CRAC 작동 원리 알아보기', 'Learn how the CRAC works'), need: ['crac'] },
      { id: 'L1-4', text: B('UPS 찾아보기', 'Find the UPS'), need: ['ups'] },
    ],
    talk: B(['여기는 소규모 서버실이에요. 작은 회사의 업무 시스템이 여기서 돌아가요.', '서버 랙, 냉각 장치, 전원 장치를 하나씩 찾아볼까요?'],
      ['This is a small server room. A small company runs its systems here.', 'Shall we find the racks, the cooling unit and the power equipment?']),
  },
  ...MORE_LEVELS,
];
