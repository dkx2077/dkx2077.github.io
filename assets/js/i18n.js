// Interface text in English and Chinese. CV facts in the page body stay exactly as Kaixin wrote them.
export const STR = {
  en: {
    skip: 'Skip to the research',
    sceneLabel: 'A seaside road full of pelicans and bicycles. Drag or use the arrow keys to look around.',
    lede: 'Kaixin Deng writes papers on LLM evaluation and computer vision. This page is one long answer to the pelican test.',
    navLabel: 'Sections',
    navAbout: 'About', navPubs: 'Publications', navAwards: 'Awards', navContact: 'Contact',
    hint: 'Drag to look around. Tap a rider to inspect it. Tap the sky to throw a fish.',
    run: 'Run',
    runHelp: 'Adds one more freshly generated pelican to the road.',
    toolsLabel: 'Scene controls',
    tBell: 'Ring every bell', tEval: 'Evaluate', tEvalTitle: 'Mark every rider against the prompt',
    tCond: 'Time and wind', tSound: 'Sound', tPause: 'Pause the scene', tPlay: 'Play the scene',
    cTime: 'Time of day', cNow: 'Follow my clock', cWind: 'Wind',
    windBack: 'gale, head-on', windHead: 'headwind', windCalm: 'calm', windTail: 'tailwind', windStorm: 'tailwind, strong',
    close: 'Close', copySvg: 'Copy SVG', copied: 'SVG copied. Paste it anywhere.', copyFail: 'Could not reach the clipboard.',
    no: (n, t) => `No. ${n} of ${t}`,
    rowPelican: 'A pelican is present', rowBicycle: 'A bicycle is present', rowRiding: 'The pelican is riding the bicycle',
    pelican: 'pelican', bicycle: 'bicycle', pass: 'PASS', fail: 'FAIL', na: 'N/A',
    gulp: 'gulp',
    generated: (n) => `Sample ${n} is on the road.`,
    evalOn: (n, p, f, u) => `${n} submissions marked: ${p} pass, ${f} fail, ${u} need a human.`, evalOff: 'Evaluation off.',
    fed: { 1: 'One fish delivered.', 5: 'Five fish. Word is getting around.', 10: 'Ten fish. You are now the most trusted provider on this road.', 25: 'Twenty-five fish. They do have a ride to finish.' },
    bells: (n) => (n ? `${n} bells.` : 'No bells in earshot.'),
    soundOn: 'Sound on.', soundOff: 'Sound off.',
    crossWait: 'Button pressed. Riders, prepare to stop.', crossGo: 'Pelicans crossing.', crossBusy: 'Already crossing.',
    press: 'Press the button',
    moonLabel: 'The moon. Opens a Starry Night version of this scene.',
    starryNote: 'Tap the sky to add a star. Tap the moon to go back.',
    starryExit: 'Back to the road',
    starryLabel: 'The same seaside road, repainted in the brush strokes of Van Gogh’s Starry Night: a swirling sky, a crescent moon, and pelicans riding bicycles.',
    hAbout: 'About', hEdu: 'Education', hIntern: 'Internships', hPubs: 'Publications', hAwards: 'Awards', hContact: 'Contact',
    hAppendix: 'Appendix: the pelicans',
    aboutLead: "I'm Kaixin Deng. My papers cover large language model evaluation, multimodal understanding and computer vision.",
    pubsNote: 'The complete list is on',
    patent: 'Patent',
    contactText: "I'm always eager to learn and humbled by new challenges, whether in cutting-edge research or hands-on engineering. Please feel free to reach out if you'd like to discuss ideas, explore collaborations, or have any questions.",
    appendixP1: 'In October 2024 Simon Willison began asking every new language model to <q>Generate an SVG of a pelican riding a bicycle</q>. It started as a joke benchmark and turned into the first thing many people try on a new model. <a href="https://simonwillison.net/tags/pelican-riding-a-bicycle/">His running collection</a> is the reference.',
    appendixP2: 'Models answer that prompt once. This page answers it about twenty times and gets most of them wrong on purpose. Each entry below is marked on the three things the prompt asks for.',
    tableCaption: 'Table 1. Every submission currently on the road, marked against the prompt.',
    thNo: 'No.', thSub: 'Submission', thPel: 'Pelican', thBike: 'Bicycle', thRide: 'Riding', thRuling: 'Ruling', thShow: 'Show', show: 'Show',
    credits: 'Every pelican is SVG drawn in code, with no images and no libraries.',
    source: 'Source on GitHub',
    langButton: '中文', langAria: '切换到中文',
    title: 'Kaixin Deng',
  },
  zh: {
    skip: '跳到研究内容',
    sceneLabel: '一条海滨公路，路上全是鹈鹕和自行车。拖动或按方向键可以左右看。',
    lede: '邓楷馨（Kaixin Deng），写大模型评测和计算机视觉方向的论文。这个主页是对“鹈鹕测试”的一份超长答卷。',
    navLabel: '栏目',
    navAbout: '关于', navPubs: '论文', navAwards: '奖项', navContact: '联系',
    hint: '拖动可以左右看。点一位骑手看详情。点天空可以扔鱼。',
    run: '运行',
    runHelp: '再生成一只新的鹈鹕上路。',
    toolsLabel: '场景控制',
    tBell: '全体按铃', tEval: '评测', tEvalTitle: '按题目给每位骑手打分',
    tCond: '时间与风', tSound: '声音', tPause: '暂停场景', tPlay: '继续播放',
    cTime: '时间', cNow: '跟随我的时钟', cWind: '风',
    windBack: '迎面大风', windHead: '逆风', windCalm: '无风', windTail: '顺风', windStorm: '强顺风',
    close: '关闭', copySvg: '复制 SVG', copied: 'SVG 已复制，可以粘贴到任何地方。', copyFail: '无法访问剪贴板。',
    no: (n, t) => `第 ${n} 号，共 ${t} 个`,
    rowPelican: '画面里有鹈鹕', rowBicycle: '画面里有自行车', rowRiding: '鹈鹕在骑自行车',
    pelican: '鹈鹕', bicycle: '自行车', pass: '通过', fail: '不通过', na: '不评分',
    gulp: '咕咚',
    generated: (n) => `样本 ${n} 已上路。`,
    evalOn: (n, p, f, u) => `已评 ${n} 份答卷：${p} 份通过，${f} 份不通过，${u} 份需要人工复核。`, evalOff: '评测已关闭。',
    fed: { 1: '已投喂一条鱼。', 5: '五条鱼了。消息正在传开。', 10: '十条鱼。你现在是这条路上最受信任的供应商。', 25: '二十五条了。它们还得接着骑车呢。' },
    bells: (n) => (n ? `${n} 个车铃响了。` : '附近没有车铃。'),
    soundOn: '声音已开。', soundOff: '声音已关。',
    crossWait: '按钮已按下。各位骑手准备停车。', crossGo: '鹈鹕正在过街。', crossBusy: '已经在过街了。',
    press: '按下过街按钮',
    moonLabel: '月亮。点一下，把这个场景换成《星月夜》的画法。',
    starryNote: '点天空添一颗星。再点月亮就回去。',
    starryExit: '回到公路',
    starryLabel: '同一条海滨公路，换成梵高《星月夜》的笔触：旋转的夜空，一弯新月，还有骑自行车的鹈鹕们。',
    hAbout: '关于', hEdu: '教育经历', hIntern: '实习经历', hPubs: '论文', hAwards: '奖项', hContact: '联系',
    hAppendix: '附录：关于这些鹈鹕',
    aboutLead: '我是邓楷馨（Kaixin Deng）。我的论文涉及大语言模型评测、多模态理解和计算机视觉。',
    pubsNote: '完整列表见',
    patent: '专利',
    contactText: '我始终乐于学习，也愿意接受新的挑战，无论是前沿研究还是动手做工程。如果你想讨论想法、探讨合作，或者有任何问题，欢迎随时联系我。',
    appendixP1: '2024 年 10 月起，Simon Willison 开始让每一个新发布的大模型<q lang="en">Generate an SVG of a pelican riding a bicycle</q>（生成一张鹈鹕骑自行车的 SVG）。它起初只是个玩笑式的测试，后来成了很多人拿到新模型后先试的第一件事。<a href="https://simonwillison.net/tags/pelican-riding-a-bicycle/">他持续更新的合集</a>是最权威的参考。',
    appendixP2: '模型对这道题只回答一次。这个页面回答了二十来次，而且大部分是故意答错的。下表按题目要求的三件事逐项打分。',
    tableCaption: '表 1：目前路上的全部答卷，按题目逐项打分。',
    thNo: '编号', thSub: '答卷', thPel: '鹈鹕', thBike: '自行车', thRide: '在骑', thRuling: '裁定', thShow: '查看', show: '查看',
    credits: '所有鹈鹕都是用代码画出来的 SVG，没有图片，也没有用任何库。',
    source: 'GitHub 源码',
    langButton: 'EN', langAria: 'Switch to English',
    title: '邓楷馨 Kaixin Deng',
  },
};

export function detectLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function applyLang(lang) {
  const s = STR[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en';
  for (const n of document.querySelectorAll('[data-i18n]')) if (typeof s[n.dataset.i18n] === 'string') n.textContent = s[n.dataset.i18n];
  for (const n of document.querySelectorAll('[data-i18n-html]')) if (s[n.dataset.i18nHtml]) n.innerHTML = s[n.dataset.i18nHtml];
  for (const n of document.querySelectorAll('[data-i18n-aria]')) if (s[n.dataset.i18nAria]) n.setAttribute('aria-label', s[n.dataset.i18nAria]);
  for (const n of document.querySelectorAll('[data-i18n-title]')) if (s[n.dataset.i18nTitle]) n.title = s[n.dataset.i18nTitle];
  document.title = s.title;
  try {
    localStorage.setItem('lang', lang);
  } catch {}
  return s;
}
