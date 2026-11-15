/* @ds-bundle: {"format":4,"namespace":"BrightTrail","components":[{"name":"Icon"},{"name":"KidButton"},{"name":"IconButton"},{"name":"FlagButton"},{"name":"Button"},{"name":"Avatar"},{"name":"AvatarTile"},{"name":"AvatarPicker"},{"name":"EmojiVisual"},{"name":"ChoiceTile"},{"name":"Keypad"},{"name":"NumberLine"},{"name":"FeedbackPanel"},{"name":"StoryCard"},{"name":"ProgressDots"},{"name":"TrailMap"},{"name":"StateBadge"},{"name":"SkillGraph"},{"name":"ParentFrame"},{"name":"Section"},{"name":"ParentRow"},{"name":"TextField"},{"name":"ChipGroup"},{"name":"Toggle"},{"name":"PinPad"},{"name":"ConfirmButton"},{"name":"EmptyState"},{"name":"Loading"},{"name":"Device"}]} */
(function () {
  var React = window.React, h = React.createElement, useState = React.useState, useRef = React.useRef, useMemo = React.useMemo;
  function cx() { return Array.prototype.slice.call(arguments).filter(Boolean).join(' '); }
  function S(n) { return 'calc(' + n + 'px * var(--s, 1))'; }
  function fmt(v) { return String(Number(Number(v).toFixed(6))); }
  function controlled(p, key, init) {
    var st = useState(p[key] != null ? p[key] : init);
    return [p.controlled ? p[key] : st[0], function (v) { st[1](v); }];
  }

  /* ---------------- Icons ---------------- */
  var P = {
    speaker: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
    flag: ['M6 21V4', 'M6 4.5h11l-2.5 4 2.5 4H6'],
    home: ['M3.5 11 12 4l8.5 7', 'M6 9.5V20h12V9.5', 'M10 20v-5h4v5'],
    lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
    back: ['M14.5 5.5 8 12l6.5 6.5'],
    next: ['M9.5 5.5 16 12l-6.5 6.5'],
    check: ['M5 12.5 9.5 17 19 7.5'],
    backspace: ['M9 5.5h11v13H9L3.5 12z', 'M12.5 9.5l5 5', 'M17.5 9.5l-5 5'],
    pause: ['M9 6v12', 'M15 6v12'],
    play: [{ f: 'M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z' }],
    plus: ['M12 5v14', 'M5 12h14'],
    share: ['M12 3.5v11', 'M7.5 8 12 3.5 16.5 8', 'M5.5 13v6.5h13V13'],
    chevron: ['M9.5 6 15.5 12l-6 6'],
    sprout: ['M12 20.5V12', 'M12 13C12 9 9.3 7 5 7c0 4 2.7 6 7 6z', 'M12 11c0-3.2 2.4-5.2 6.5-5.2 0 3.2-2.4 5.2-6.5 5.2z'],
    refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
    question: ['M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.8v.6', { f: 'M12 16.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z' }],
    half: ['M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16z', { f: 'M12 4a8 8 0 0 1 0 16z' }],
    gap: ['M12 4a8 8 0 1 1-7.6 5.5'],
    star: [{ f: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z' }],
    moon: ['M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z'],
    book: ['M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2', 'M12 6.5c1.5-1.5 3.5-2 8-2v14c-4.5 0-6.5.5-8 2', 'M12 6.5v14'],
    close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
    alert: ['M12 3.5 21 19.5H3z', 'M12 10v4', { f: 'M12 16.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z' }],
    tree: ['M4 5h6v4H4z', 'M14 5h6v4h-6z', 'M9 15h6v4H9z', 'M7 9v3h10V9', 'M12 12v3'],
    list: ['M9 6.5h11', 'M9 12h11', 'M9 17.5h11', { f: 'M4.5 5.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM4.5 10.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM4.5 16.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z' }],
    bookmark: ['M7 4h10v16l-5-3.5L7 20z'],
    hand: ['M9 11V5a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16']
  };
  function Icon(p) {
    var parts = P[p.name] || [];
    return h('svg', { className: cx('bt-icon', p.className), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', style: p.size ? { fontSize: p.size } : undefined },
      parts.map(function (d, i) {
        return typeof d === 'string'
          ? h('path', { key: i, d: d, fill: 'none', stroke: 'currentColor', strokeWidth: p.stroke || 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' })
          : h('path', { key: i, d: d.f, fill: 'currentColor' });
      }));
  }
  Icon.names = Object.keys(P);
  function Star(p) {
    return h('svg', { className: cx('bt-icon bt-star', p.className), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', style: p.size ? { fontSize: p.size } : undefined },
      h('path', { d: P.star[0].f, style: { fill: p.empty ? 'none' : 'var(--star)', stroke: 'var(--star-ink)' }, strokeWidth: 1.6, strokeLinejoin: 'round' }));
  }

  /* ---------------- Buttons ---------------- */
  function KidButton(p) {
    return h('button', {
      type: 'button', className: cx('bt-kbtn', 'bt-kbtn-' + (p.variant || 'primary'), p.size && 'bt-kbtn-' + p.size, p.className),
      'aria-label': p.label, onClick: p.onClick, disabled: p.disabled
    },
      p.icon && h(Icon, { name: p.icon, stroke: 3 }),
      p.showLabel ? h('span', { className: 'bt-kbtn-cap', 'aria-hidden': 'true' }, p.label) : null);
  }
  function IconButton(p) {
    return h('button', {
      type: 'button', className: cx('bt-ibtn', 'bt-ibtn-' + (p.variant || 'kid'), p.className),
      'aria-label': p.label, title: p.label, onClick: p.onClick, 'aria-pressed': p.pressed
    }, h(Icon, { name: p.icon, stroke: p.variant === 'quiet' ? 2.2 : 2.6 }));
  }
  function ReplayButton(p) { return h(IconButton, { icon: 'speaker', label: p.label || 'Hear it again', onClick: p.onClick }); }
  function FlagButton(p) {
    var s = controlled(p, 'flagged', false), flagged = s[0];
    if (flagged) return h('span', { className: 'bt-flag-thanks', role: 'status' }, h(Icon, { name: 'check', stroke: 3 }), 'Thanks for telling us');
    return h(IconButton, { icon: 'flag', label: 'This looks wrong', variant: 'quiet', onClick: function () { s[1](true); if (p.onFlag) p.onFlag(); } });
  }
  function Button(p) {
    return h('button', {
      type: p.type || 'button', className: cx('bt-btn', 'bt-btn-' + (p.variant || 'primary'), p.small && 'bt-btn-small', p.full && 'bt-btn-full', p.className),
      onClick: p.onClick, disabled: p.disabled
    }, p.icon && h(Icon, { name: p.icon }), p.children);
  }

  /* ---------------- Avatars ---------------- */
  var ANIMALS = {
    fox: ['🦊', 'Fox', 'peach'], owl: ['🦉', 'Owl', 'sky'], penguin: ['🐧', 'Penguin', 'sky'], frog: ['🐸', 'Frog', 'mint'],
    lion: ['🦁', 'Lion', 'peach'], unicorn: ['🦄', 'Unicorn', 'lilac'], octopus: ['🐙', 'Octopus', 'lilac'], dinosaur: ['🦕', 'Dinosaur', 'mint'],
    panda: ['🐼', 'Panda', 'mint'], cheetah: ['🐆', 'Cheetah', 'peach']
  };
  function Avatar(p) {
    var a = ANIMALS[p.animal] || ANIMALS.fox;
    var props = { className: cx('bt-avatar', 'bt-tint-' + a[2], p.className), style: { '--av': p.size || S(64) } };
    if (p.decorative) props['aria-hidden'] = 'true'; else { props.role = 'img'; props['aria-label'] = p.label || a[1]; }
    return h('span', props, a[0]);
  }
  function AvatarTile(p) {
    var a = ANIMALS[p.animal] || ANIMALS.fox;
    return h('button', { type: 'button', className: 'bt-avtile', onClick: p.onClick, 'aria-label': p.name + ', the ' + a[1].toLowerCase() },
      h(Avatar, { animal: p.animal, size: p.size || S(112), decorative: true }),
      h('span', { className: 'bt-avtile-name', 'aria-hidden': 'true' }, p.name));
  }
  function AvatarPicker(p) {
    var s = controlled(p, 'value', 'fox');
    return h('div', { className: 'bt-field' },
      h('span', { className: 'bt-label' }, p.label || 'Avatar'),
      h('div', { className: cx('bt-avpick', p.wide && 'bt-avpick-wide'), role: 'radiogroup', 'aria-label': p.label || 'Avatar' },
        Object.keys(ANIMALS).map(function (k) {
          return h('button', { key: k, type: 'button', role: 'radio', 'aria-checked': s[0] === k, className: 'bt-avpick-opt', onClick: function () { s[1](k); if (p.onChange) p.onChange(k); } },
            h(Avatar, { animal: k, size: '44px', decorative: true }), ANIMALS[k][1]);
        })));
  }

  /* ---------------- Visuals from data ---------------- */
  function EmojiVisual(p) {
    var kind = p.kind || 'single', n = p.count || 0, e = p.emoji || '⭐', label = p.label || '';
    if (kind === 'single') return h('div', { className: 'bt-ev bt-ev-single', role: 'img', 'aria-label': label || e }, e);
    if (kind === 'row') {
      var groups = [];
      for (var g = 0; g < Math.ceil(n / 5); g++) {
        var items = [];
        for (var i = g * 5; i < Math.min(n, g * 5 + 5); i++) items.push(h('span', { key: i }, e));
        groups.push(h('span', { key: g, className: 'bt-ev-five' }, items));
      }
      return h('div', { className: 'bt-ev bt-ev-row', role: 'img', 'aria-label': n + ' ' + label }, groups);
    }
    if (kind === 'tenframe') {
      var frames = p.frames || Math.max(1, Math.ceil(n / 10)), out = [];
      for (var f = 0; f < frames; f++) {
        var cells = [];
        for (var c = 0; c < 10; c++) cells.push(h('span', { key: c, className: 'bt-tf-cell' }, f * 10 + c < n ? h('span', { className: 'bt-tf-dot' }) : null));
        out.push(h('div', { key: f, className: 'bt-tf' }, cells));
      }
      return h('div', { className: 'bt-ev bt-ev-tf', role: 'img', 'aria-label': n + ' dots in a ten-frame' }, out);
    }
    return h('div', { className: 'bt-ev-slot', role: 'img', 'aria-label': label || 'Picture' }, h(Icon, { name: 'book' }), h('span', null, p.caption || 'Illustration slot · 16:9'));
  }

  /* ---------------- Answer inputs ---------------- */
  function ChoiceTile(p) {
    var st = p.state || 'idle', done = st !== 'idle';
    var badge = st === 'right' ? 'check' : st === 'missed' ? 'sprout' : null;
    var spoken = p.ariaLabel || String(p.label);
    if (st === 'right') spoken += ', right answer'; else if (st === 'missed') spoken += ', your answer';
    return h('button', {
      type: 'button', className: cx('bt-choice', 'bt-choice-' + st, p.className), onClick: done ? undefined : p.onClick,
      'aria-disabled': done || undefined, 'aria-label': spoken
    },
      h('span', { 'aria-hidden': 'true' }, p.label),
      badge && h('span', { className: 'bt-choice-badge', 'aria-hidden': 'true' }, h(Icon, { name: badge, stroke: 3.2 })));
  }

  function Keypad(p) {
    var s = controlled(p, 'value', ''), value = s[0];
    function press(k) {
      if (p.result) return;
      var nv = value;
      if (k === 'del') nv = value.slice(0, -1);
      else if (k === '.' && value.indexOf('.') >= 0) return;
      else if (value.length >= (p.maxLength || 6)) return;
      else nv = value + k;
      s[1](nv); if (p.onChange) p.onChange(nv);
    }
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', p.decimal ? '.' : '', '0', 'del'];
    var display = h('div', {
      className: cx('bt-kp-display', !value && 'is-empty', p.result && 'is-' + p.result), role: 'status', 'aria-live': 'polite',
      'aria-label': value ? 'Your number: ' + value : 'No number yet'
    }, value || '?');
    var submit = h('button', {
      type: 'button', className: 'bt-kp-key bt-kp-submit', 'aria-label': 'Check my answer', disabled: !value || !!p.result,
      onClick: function () { if (p.onSubmit) p.onSubmit(value); }
    }, h(Icon, { name: 'check', stroke: 3.2 }));
    var grid = keys.map(function (k, i) {
      if (!k) return h('span', { key: i, className: 'bt-kp-key bt-kp-blank' });
      return h('button', {
        key: i, type: 'button', className: 'bt-kp-key', onClick: function () { press(k); },
        'aria-label': k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k
      }, k === 'del' ? h(Icon, { name: 'backspace' }) : k);
    });
    if (p.layout === 'side') {
      return h('div', { className: 'bt-kp bt-kp-side' },
        h('div', { className: 'bt-kp-col' }, display, p.after || (!p.hideKeys && h('div', { className: 'bt-kp-keys' }, submit))),
        !p.hideKeys && h('div', { className: 'bt-kp-keys' }, grid));
    }
    return h('div', { className: 'bt-kp' }, display, !p.hideKeys && h('div', { className: 'bt-kp-keys' }, grid, submit));
  }

  function NumberLine(p) {
    var min = p.min != null ? p.min : 0, max = p.max != null ? p.max : 10, step = p.step || 1;
    var mid = Math.round((min + max) / 2 / step) * step;
    var s = controlled(p, 'value', mid), value = s[0];
    var ref = useRef(null), drag = useRef(false);
    var X0 = 60, X1 = 940;
    function xOf(v) { return X0 + (v - min) / (max - min) * (X1 - X0); }
    function snap(v) { var q = Math.round((v - min) / step) * step + min; return Math.min(max, Math.max(min, Number(q.toFixed(6)))); }
    function set(v) { if (p.revealed) return; v = snap(v); s[1](v); if (p.onChange) p.onChange(v); }
    function fromEvent(e) { var r = ref.current.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width * 1000; return min + (x - X0) / (X1 - X0) * (max - min); }
    var n = Math.round((max - min) / step), every = n <= 10 ? 1 : n <= 20 ? 2 : Math.ceil(n / 10), ticks = [];
    for (var i = 0; i <= n; i++) {
      var v = Number((min + i * step).toFixed(6)), x = xOf(v), major = i % every === 0 || i === n;
      ticks.push(h('g', { key: i },
        h('line', { className: 'bt-nl-tick', x1: x, x2: x, y1: major ? 92 : 100, y2: major ? 128 : 120 }),
        major && h('text', { className: 'bt-nl-label', x: x, y: 176, textAnchor: 'middle' }, fmt(v))));
    }
    function pin(v, cls, label) {
      return h('g', { className: 'bt-nl-pin ' + cls, transform: 'translate(' + xOf(v) + ' 0)' },
        h('path', { d: 'M0 106 L-18 70 A30 30 0 1 1 18 70 Z' }),
        label != null && h('text', { className: 'bt-nl-pin-text', y: 57, textAnchor: 'middle' }, label));
    }
    var wrong = p.revealed && p.answer != null && value !== p.answer;
    var svg = h('svg', {
      ref: ref, viewBox: '0 0 1000 190', className: 'bt-nl-svg', role: 'slider', tabIndex: 0,
      'aria-valuemin': min, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': p.label || 'Number line',
      onPointerDown: function (e) { if (p.revealed) return; drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); set(fromEvent(e)); },
      onPointerMove: function (e) { if (drag.current) set(fromEvent(e)); },
      onPointerUp: function () { drag.current = false; },
      onKeyDown: function (e) { if (e.key === 'ArrowLeft') set(value - step); if (e.key === 'ArrowRight') set(value + step); }
    },
      h('line', { className: 'bt-nl-axis', x1: X0 - 30, x2: X1 + 30, y1: 110, y2: 110 }),
      ticks,
      (!p.revealed || wrong) && pin(value, wrong ? 'bt-nl-pin-miss' : 'bt-nl-pin-you'),
      p.revealed && p.answer != null && pin(p.answer, 'bt-nl-pin-ans', fmt(p.answer)));
    var controls = !p.revealed && h('div', { className: 'bt-nl-controls' },
      h(KidButton, { icon: 'back', label: 'Move left', variant: 'plain', onClick: function () { set(value - step); } }),
      h(KidButton, { icon: 'check', label: 'Check my answer', onClick: function () { if (p.onSubmit) p.onSubmit(value); } }),
      h(KidButton, { icon: 'next', label: 'Move right', variant: 'plain', onClick: function () { set(value + step); } }));
    return h('div', { className: 'bt-nl' }, svg, controls);
  }

  function FeedbackPanel(p) {
    var hit = p.result !== 'miss';
    return h('div', { className: cx('bt-fb', hit ? 'bt-fb-hit' : 'bt-fb-miss', p.className), role: 'status' },
      h('div', { className: 'bt-fb-icon', 'aria-hidden': 'true' }, hit ? h(Star) : h(Icon, { name: 'sprout', stroke: 2.2 })),
      h('div', { className: 'bt-fb-text' },
        h('p', { className: 'bt-fb-title' }, hit ? 'Yes! Great job!' : 'Good try!'),
        !hit && p.why && h('p', { className: 'bt-fb-why' }, p.why)),
      h(KidButton, { icon: 'next', label: 'Next', onClick: p.onNext }));
  }

  /* ---------------- Story and progress ---------------- */
  function StoryCard(p) {
    return h('article', { className: cx('bt-story', p.readingMode && 'bt-story-reading', p.className), 'aria-label': p.narration },
      p.visual,
      p.text != null && h('p', { className: 'bt-story-text' }, p.text),
      p.narration && h('p', { className: 'bt-story-narr' }, p.narration));
  }
  function ProgressDots(p) {
    var dots = [];
    for (var i = 0; i < p.total; i++) dots.push(h('span', { key: i, className: cx('bt-dot', i < p.current && 'is-done', i === p.current && 'is-now') }));
    return h('div', { className: cx('bt-dots', p.variant === 'steps' && 'bt-dots-steps'), role: 'img', 'aria-label': (p.noun || 'Card') + ' ' + (p.current + 1) + ' of ' + p.total }, dots);
  }

  var STOP_WORDS = { mastered: 'done, it has a star', next: 'your next stop', review: 'time for a quick review', ahead: 'coming up', locked: 'not open yet' };
  function TrailMap(p) {
    var stops = p.stops || [], n = stops.length, horiz = p.orientation === 'horizontal';
    var nextI = -1;
    stops.forEach(function (s, i) { if (nextI < 0 && s.state === 'next') nextI = i; });
    var pts = stops.map(function (s, i) {
      if (horiz) return [(i + 0.5) / n * 100, [64, 36][i % 2]];
      return [[50, 76, 50, 24][i % 4], (n - i - 0.5) / n * 100];
    });
    function seg(a, b) {
      var m;
      if (horiz) { m = (a[0] + b[0]) / 2; return ' C' + m + ' ' + a[1] + ' ' + m + ' ' + b[1] + ' ' + b[0] + ' ' + b[1]; }
      m = (a[1] + b[1]) / 2; return ' C' + a[0] + ' ' + m + ' ' + b[0] + ' ' + m + ' ' + b[0] + ' ' + b[1];
    }
    var cut = nextI < 0 ? n - 1 : nextI, done = 'M' + pts[0][0] + ' ' + pts[0][1], ahead = 'M' + pts[cut][0] + ' ' + pts[cut][1];
    for (var i = 1; i < n; i++) { if (i <= cut) done += seg(pts[i - 1], pts[i]); else ahead += seg(pts[i - 1], pts[i]); }
    var nodes = stops.map(function (s, i) {
      var st = s.state || 'ahead', inner;
      if (st === 'mastered' || st === 'review') inner = h(Star);
      else if (st === 'next') inner = h(Icon, { name: 'play' });
      else if (st === 'locked') inner = h(Icon, { name: 'lock' });
      else inner = h('span', { 'aria-hidden': 'true' }, i + 1);
      return h('div', { key: i, className: cx('bt-stop', 'bt-stop-' + st), style: { left: pts[i][0] + '%', top: pts[i][1] + '%' } },
        st === 'next' && p.avatar && h(Avatar, { animal: p.avatar, size: S(52), className: 'bt-stop-avatar', decorative: true }),
        h('button', { type: 'button', className: cx('bt-stone', 'bt-stone-' + st), 'aria-label': (s.title || 'Stop ' + (i + 1)) + ', ' + STOP_WORDS[st], onClick: s.onClick },
          inner,
          st === 'review' && h('span', { className: 'bt-stone-badge', 'aria-hidden': 'true' }, h(Icon, { name: 'refresh', stroke: 3.2 }))),
        s.title && h('span', { className: 'bt-stop-cap', 'aria-hidden': 'true' }, s.title));
    });
    var size = horiz ? { height: S(p.height || 300) } : { height: 'calc(' + n * (p.rowHeight || 112) + 'px * var(--s, 1))' };
    return h('div', { className: cx('bt-trail', p.className), style: size, role: 'group', 'aria-label': p.label || 'Your trail' },
      h('svg', { className: 'bt-trail-svg', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
        h('path', { className: 'bt-trail-ahead', d: ahead }), h('path', { className: 'bt-trail-done', d: done })),
      nodes);
  }

  /* ---------------- Skill states ---------------- */
  var STATES = {
    unknown: ['Unknown', 'question', 'Not asked yet.'],
    assumed: ['Assumed', 'half', 'Taken as known from grade, not asked.'],
    gap: ['Gap', 'gap', 'Missed in placement or a check. Taught next.'],
    learning: ['Learning', 'sprout', 'Story seen, check not passed yet.'],
    mastered: ['Mastered', 'star', 'Passed a check: 4 of 5 right.'],
    review: ['Review due', 'refresh', 'Mastered and due for a 3-question review.']
  };
  function StateBadge(p) {
    var s = STATES[p.state] || STATES.unknown;
    return h('span', { className: cx('bt-badge', 'bt-state-' + (STATES[p.state] ? p.state : 'unknown'), p.compact && 'bt-badge-compact'), title: p.compact ? s[0] : undefined },
      h(Icon, { name: s[1], stroke: 2.4 }),
      h('span', { className: p.compact ? 'bt-sr' : undefined }, s[0]));
  }
  function StateLegend(p) {
    if (p.inline) return h('div', { className: 'bt-legend-inline' }, Object.keys(STATES).map(function (k) { return h(StateBadge, { key: k, state: k }); }));
    return h('ul', { className: 'bt-legend' }, Object.keys(STATES).map(function (k) {
      return h('li', { key: k }, h(StateBadge, { state: k }), h('span', { className: 'bt-legend-desc' }, STATES[k][2]));
    }));
  }
  function SkillGraph(p) {
    var nodes = p.nodes || [], edges = p.edges || [], byId = {}, W = p.width || 1000, H = p.height || 440, NW = p.nodeWidth || 180, NH = 52;
    nodes.forEach(function (n) { byId[n.id] = n; });
    return h('div', { className: 'bt-graph', style: { aspectRatio: W + ' / ' + H } },
      h('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', className: 'bt-graph-svg', 'aria-hidden': 'true' },
        edges.map(function (e, i) {
          var a = byId[e[0]], b = byId[e[1]]; if (!a || !b) return null;
          var x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, m = (x1 + x2) / 2;
          return h('path', { key: i, className: 'bt-graph-edge', d: 'M' + x1 + ' ' + y1 + ' C' + m + ' ' + y1 + ' ' + m + ' ' + y2 + ' ' + x2 + ' ' + y2 });
        })),
      (p.columns || []).map(function (c) { return h('span', { key: c.label, className: 'bt-graph-col', style: { left: c.x / W * 100 + '%' } }, c.label); }),
      nodes.map(function (n) {
        return h('button', {
          key: n.id, type: 'button', className: cx('bt-gnode', 'bt-gnode-' + n.state),
          style: { left: n.x / W * 100 + '%', top: n.y / H * 100 + '%', width: NW / W * 100 + '%', height: NH / H * 100 + '%' },
          'aria-label': n.title + ', ' + (STATES[n.state] || STATES.unknown)[0]
        }, h(StateBadge, { state: n.state, compact: true }), h('span', { className: 'bt-gnode-title' }, n.title));
      }));
  }

  /* ---------------- Parent frame ---------------- */
  function ParentFrame(p) {
    return h('div', { className: cx('bt-parent bt-pframe', p.wide && 'bt-pframe-wide', p.className) },
      h('header', { className: 'bt-pframe-head' },
        p.back !== false && h('button', { type: 'button', className: 'bt-back', onClick: p.onBack }, h(Icon, { name: 'back' }), p.back || 'Back'),
        p.title && h('h1', { className: 'bt-pframe-title' }, p.title)),
      h('div', { className: 'bt-pframe-body' }, p.children));
  }
  function Section(p) {
    return h('section', { className: 'bt-section', 'aria-label': p.title },
      (p.title || p.action) && h('div', { className: 'bt-section-head' }, h('h2', { className: 'bt-section-title' }, p.title), p.action),
      p.description && h('p', { className: 'bt-section-desc' }, p.description),
      p.plain ? p.children : h('div', { className: cx('bt-card', p.padded && 'bt-card-pad') }, p.children));
  }
  function ParentRow(p) {
    var tag = p.onClick || p.chevron ? 'button' : 'div';
    return h(tag, { type: tag === 'button' ? 'button' : undefined, className: cx('bt-row', p.action && 'bt-row-action'), onClick: p.onClick },
      p.leading && h('span', { className: 'bt-row-lead' }, p.leading),
      h('span', { className: 'bt-row-main' }, h('span', { className: 'bt-row-title' }, p.title), p.meta && h('span', { className: 'bt-row-meta' }, p.meta)),
      p.trailing, p.chevron && h(Icon, { name: 'chevron', className: 'bt-row-chev' }));
  }

  /* ---------------- Form fields ---------------- */
  var uid = 0;
  function TextField(p) {
    var id = useMemo(function () { uid += 1; return 'bt-f' + uid; }, []);
    var msg = p.error || p.hint;
    return h('div', { className: cx('bt-field', p.error && 'bt-field-error') },
      h('label', { className: 'bt-label', htmlFor: id }, p.label),
      h('input', {
        id: id, className: 'bt-input', type: p.type || 'text', defaultValue: p.value, placeholder: p.placeholder, inputMode: p.inputMode,
        'aria-invalid': p.error ? 'true' : undefined, 'aria-describedby': msg ? id + '-d' : undefined, onChange: p.onChange
      }),
      p.error ? h('span', { id: id + '-d', className: 'bt-err', role: 'alert' }, h(Icon, { name: 'alert' }), p.error)
        : p.hint && h('span', { id: id + '-d', className: 'bt-hint' }, p.hint));
  }
  function ChipGroup(p) {
    var s = controlled(p, 'value', null);
    return h('div', { className: 'bt-field' },
      p.label && h('span', { className: 'bt-label' }, p.label),
      h('div', { className: 'bt-chips', role: 'radiogroup', 'aria-label': p.label },
        p.options.map(function (o) {
          var val = typeof o === 'object' ? o.value : o, sel = val === s[0];
          return h('button', { key: val, type: 'button', role: 'radio', 'aria-checked': sel, className: 'bt-chip', onClick: function () { s[1](val); if (p.onChange) p.onChange(val); } },
            sel && h(Icon, { name: 'check', stroke: 3 }), typeof o === 'object' ? o.label : o);
        })),
      p.hint && h('span', { className: 'bt-hint' }, p.hint));
  }
  function Toggle(p) {
    var s = controlled(p, 'checked', false), on = !!s[0];
    return h('button', { type: 'button', role: 'switch', 'aria-checked': on, className: 'bt-toggle', onClick: function () { s[1](!on); if (p.onChange) p.onChange(!on); } },
      h('span', { className: 'bt-toggle-text' }, h('span', { className: 'bt-label' }, p.label), p.hint && h('span', { className: 'bt-hint' }, p.hint)),
      h('span', { className: 'bt-toggle-state', 'aria-hidden': 'true' }, on ? 'On' : 'Off'),
      h('span', { className: 'bt-switch', 'aria-hidden': 'true' }));
  }
  var PIN_COPY = {
    create: ['Pick a parent PIN', 'Pick 4 digits your kids don’t know'],
    confirm: ['Confirm your PIN', 'Enter the PIN again'],
    enter: ['Parent PIN', 'Grown-ups only past this point']
  };
  function PinPad(p) {
    var len = p.length || 4, s = controlled(p, 'value', ''), v = s[0], copy = PIN_COPY[p.mode || 'enter'];
    function press(k) {
      if (k === 'del') return s[1](v.slice(0, -1));
      if (v.length >= len) return;
      var nv = v + k; s[1](nv);
      if (nv.length === len && p.onComplete) p.onComplete(nv);
    }
    var dots = [];
    for (var i = 0; i < len; i++) dots.push(h('span', { key: i, className: cx('bt-pin-dot', i < v.length && 'is-on') }));
    return h('div', { className: cx('bt-pin', p.error && 'bt-pin-err') },
      h('h2', { className: 'bt-pin-title' }, copy[0]),
      h('p', { className: 'bt-pin-hint' }, copy[1]),
      h('div', { className: 'bt-pin-dots', role: 'img', 'aria-label': v.length + ' of ' + len + ' digits entered' }, dots),
      h('p', { className: 'bt-pin-msg', role: 'alert' }, p.error ? [h(Icon, { key: 'i', name: 'alert' }), p.error] : ' '),
      h('div', { className: 'bt-pin-keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(function (k, i) {
        if (!k) return h('span', { key: i });
        return h('button', { key: i, type: 'button', className: cx('bt-pin-key', k === 'del' && 'bt-pin-ghost'), 'aria-label': k === 'del' ? 'Delete' : k, onClick: function () { press(k); } },
          k === 'del' ? h(Icon, { name: 'backspace' }) : k);
      })));
  }
  function ConfirmButton(p) {
    var s = controlled(p, 'open', false);
    if (!s[0]) return h(Button, { variant: p.tone === 'danger' ? 'secondary-danger' : 'secondary', icon: p.icon, onClick: function () { s[1](true); } }, p.label);
    return h('div', { className: 'bt-confirm', role: 'group', 'aria-label': p.label },
      h('p', { className: 'bt-confirm-text' }, h('strong', null, p.question || p.label + '?'), ' ', p.consequence),
      h('div', { className: 'bt-confirm-actions' },
        h(Button, { variant: p.tone === 'danger' ? 'danger' : 'primary', onClick: p.onConfirm }, p.confirmLabel || p.label),
        h(Button, { variant: 'secondary', onClick: function () { s[1](false); } }, p.cancelLabel || 'Cancel')));
  }

  /* ---------------- Empty and loading ---------------- */
  function EmptyState(p) {
    return h('div', { className: cx('bt-empty', p.className), role: 'status' },
      p.art ? h('div', { className: 'bt-empty-art' }, p.art) : p.icon && h('div', { className: 'bt-empty-icon' }, h(Icon, { name: p.icon })),
      h('p', { className: 'bt-empty-title' }, p.title),
      p.body && h('p', { className: 'bt-empty-body' }, p.body),
      p.action);
  }
  function Loading(p) {
    if (p.zone === 'parent') {
      var rows = [];
      for (var i = 0; i < (p.rows || 3); i++) {
        rows.push(h('div', { key: i, className: 'bt-row' }, h('span', { className: 'bt-skel bt-skel-round' }),
          h('span', { className: 'bt-row-main', style: { gap: '8px' } }, h('span', { className: 'bt-skel', style: { width: '45%' } }), h('span', { className: 'bt-skel', style: { width: '28%' } }))));
      }
      return h('div', { className: 'bt-card', role: 'status', 'aria-label': p.label || 'Loading' }, rows);
    }
    return h('div', { className: 'bt-loading', role: 'status', 'aria-label': p.label || 'Loading' },
      h('span', { className: 'bt-pebble' }), h('span', { className: 'bt-pebble' }), h('span', { className: 'bt-pebble' }));
  }

  /* ---------------- Device frames for screen boards ---------------- */
  var DEV = { phone: [390, 844, 'Phone · portrait'], 'phone-land': [844, 390, 'Phone · landscape'], tablet: [1194, 834, 'Tablet · landscape'] };
  function Device(p) {
    var kind = p.kind || 'phone', d = DEV[kind], parent = p.zone === 'parent', ref = useRef(null);
    React.useEffect(function () {
      var el = p.scroll && ref.current && ref.current.querySelector('.bt-pframe-body');
      if (el) el.scrollTop = p.scroll === 'end' ? el.scrollHeight : p.scroll;
    });
    return h('figure', { className: 'bt-dev' },
      h('div', { className: cx('bt-dev-frame', kind === 'tablet' && 'bt-dev-frame-tablet') },
        h('div', {
          ref: ref,
          className: cx('bt-dev-screen', parent ? 'bt-parent' : 'bt-kid', kind === 'tablet' && !parent && 'bt-tab', p.dyslexic && 'bt-dys', 'bt-dev-' + kind),
          style: { width: d[0], height: d[1] }
        }, p.children)),
      h('figcaption', { className: 'bt-dev-label' }, h('strong', null, p.label), d[2]));
  }
  function Board(p) {
    return h('div', { className: 'bt-board' }, p.rows.map(function (r, i) { return h('div', { key: i, className: 'bt-board-row' }, r); }));
  }

  /* ================= Screens ================= */
  function KScreen(p) {
    return h('div', { className: cx('bt-screen', p.className) },
      h('div', { className: 'bt-top' },
        h('div', { className: 'bt-top-side' }, p.left),
        h('div', { className: 'bt-top-mid' }, p.mid),
        h('div', { className: 'bt-top-side bt-top-right' }, p.right)),
      h('div', { className: cx('bt-main', p.mainClass) }, p.children),
      p.bottom && h('div', { className: cx('bt-bottom', p.spread && 'bt-bottom-spread') }, p.bottom));
  }
  function choicesGrid(labels, states, cols) {
    return h('div', { className: 'bt-choices', style: { gridTemplateColumns: 'repeat(' + (cols || labels.length) + ', 1fr)' } },
      labels.map(function (l, i) { return h(ChoiceTile, { key: i, label: l, state: states ? states[i] : 'idle' }); }));
  }
  function itemTop(p) {
    var mid = null;
    if (p.progress) mid = h(ProgressDots, { total: p.progress[1], current: p.progress[0], variant: 'steps', noun: 'Question' });
    else if (p.pause) mid = h(IconButton, { icon: 'pause', label: 'Take a break' });
    return { left: h(ReplayButton), mid: mid, right: h(FlagButton) };
  }
  var TRAIL = [
    { title: 'Count to 10', state: 'mastered' }, { title: 'Count to 20', state: 'mastered' }, { title: 'Groups of 5', state: 'review' },
    { title: 'Ten-frames', state: 'next' }, { title: 'Teen numbers', state: 'ahead' }, { title: 'Count to 50', state: 'locked' }
  ];
  var TRAIL_NEW = [{ title: 'Start here', state: 'next' }, { state: 'ahead' }, { state: 'ahead' }, { state: 'ahead' }, { state: 'locked' }];

  var Screens = {
    ProfilePicker: function (p) {
      var kids = p.kids || [];
      return h(KScreen, { left: h(ReplayButton, { label: 'Who’s playing? Tap your picture.' }), right: h(IconButton, { icon: 'lock', label: 'Grown-ups', variant: 'quiet' }) },
        kids.length ? [
          h('h1', { key: 'h', className: 'bt-prompt' }, 'Who’s playing?'),
          h('div', { key: 'g', className: 'bt-avgrid', style: { gridTemplateColumns: 'repeat(' + (p.cols || 2) + ', auto)' } },
            kids.map(function (k) { return h(AvatarTile, { key: k.name, animal: k.animal, name: k.name }); }))
        ] : h(EmptyState, {
          art: h('span', { className: 'bt-avatar bt-avatar-empty', style: { '--av': S(128) } }, h(Icon, { name: 'plus', stroke: 3 })),
          title: 'Ask a grown-up to add you.'
        }));
    },

    ChildHome: function (p) {
      var mode = p.mode || 'returning', land = p.land;
      var stops = mode === 'new' ? TRAIL_NEW : TRAIL;
      var cta = mode === 'new' ? h(KidButton, { icon: 'play', label: 'Let’s go', showLabel: true, size: 'xl' })
        : mode === 'review' ? h(KidButton, { icon: 'refresh', label: 'Review', showLabel: true, size: 'xl' })
          : h(KidButton, { icon: 'play', label: 'Start', showLabel: true, size: 'xl' });
      var stars = mode === 'new' ? null : h('span', { className: 'bt-starpill', role: 'img', 'aria-label': '12 stars' }, h(Star), '12');
      return h(KScreen, {
        left: h(IconButton, { icon: 'home', label: 'Back to who’s playing' }),
        mid: h('div', { className: 'bt-greet' }, h(Avatar, { animal: 'penguin', size: S(56), decorative: true }), h('h1', { className: 'bt-hero' }, mode === 'new' ? 'Hi, Maya!' : 'Hi, Maya!')),
        right: h(ReplayButton, { label: mode === 'review' ? 'Hi Maya! Let’s do a quick review first.' : 'Hi Maya! Tap start.' }),
        bottom: [stars, cta].filter(Boolean), spread: !!stars && !land
      },
        h('div', { className: 'bt-trailpanel' },
          h(TrailMap, { stops: stops, avatar: 'penguin', orientation: land ? 'horizontal' : 'vertical', rowHeight: mode === 'new' ? 100 : 86, height: 280 })));
    },

    Story: function (p) {
      var cards = [
        { text: null, narration: 'Pip the penguin loves to count fish.', visual: h(EmojiVisual, { kind: 'single', emoji: '🐧', label: 'Pip the penguin' }) },
        { text: '5', narration: 'Pip catches five fish. One, two, three, four, five!', visual: h(EmojiVisual, { kind: 'row', emoji: '🐟', count: 5, label: 'fish' }) },
        { text: '7', narration: 'Two more fish swim by. Five and two make seven.', visual: h(EmojiVisual, { kind: 'row', emoji: '🐟', count: 7, label: 'fish' }) },
        { text: '10', narration: 'A full ten-frame! Pip has ten fish.', visual: h(EmojiVisual, { kind: 'tenframe', count: 10 }) }
      ];
      var c = cards[p.card != null ? p.card : 1], total = p.total || 6, idx = p.index != null ? p.index : 1, last = idx === total - 1;
      var card = h(StoryCard, { text: c.text, narration: c.narration, visual: c.visual, readingMode: p.reading });
      var back = h(KidButton, { key: 'b', icon: 'back', label: 'Back', variant: 'plain', disabled: idx === 0 });
      var next = last ? h(KidButton, { key: 'n', icon: 'check', label: 'Done', showLabel: true }) : h(KidButton, { key: 'n', icon: 'next', label: 'Next' });
      var dots = h(ProgressDots, { total: total, current: idx });
      var top = { left: h(ReplayButton), right: h(FlagButton, { flagged: p.flagged }) };
      if (p.land) return h(KScreen, Object.assign({ mid: dots }, top), h('div', { className: 'bt-side3' }, back, card, next));
      return h(KScreen, Object.assign({ bottom: [back, next], spread: true }, top), card, dots);
    },

    Tap: function (p) {
      var st = p.state || 'idle';
      var states = st === 'right' ? ['rest', 'right', 'rest'] : st === 'wrong' ? ['rest', 'right', 'missed'] : null;
      var q = [h('h1', { key: 'p', className: 'bt-prompt' }, 'How many fish?'), h(EmojiVisual, { key: 'v', kind: 'row', emoji: '🐟', count: 7, label: 'fish' })];
      var a = choicesGrid(['6', '7', '8'], states);
      var fb = st === 'idle' ? null : h(FeedbackPanel, { result: st === 'right' ? 'hit' : 'miss', why: 'Count the five, then two more: 5, 6, 7.' });
      var top = itemTop(p);
      if (p.land) return h(KScreen, top, h('div', { className: 'bt-split' }, h('div', { className: 'bt-q' }, q), h('div', { className: 'bt-a' }, a, fb)));
      return h(KScreen, Object.assign({ bottom: fb }, top), q, a);
    },

    Keypad: function (p) {
      var st = p.state || 'idle', dec = p.decimal, kind = p.kind || 'phone';
      var value = p.value != null ? p.value : st === 'wrong' ? '8' : st === 'right' ? '7' : '';
      var result = st === 'right' ? 'hit' : st === 'wrong' ? 'miss' : null;
      var fb = result && h(FeedbackPanel, { result: result, why: dec ? '0.5 and 0.2 make 0.7.' : 'A full row is 5. Two more make 7.' });
      var q = dec ? [h('h1', { key: 'p', className: 'bt-prompt' }, 'What is 0.5 + 0.2?')]
        : [h('h1', { key: 'p', className: 'bt-prompt' }, 'How many dots?'), h(EmojiVisual, { key: 'v', kind: 'tenframe', count: 7 })];
      var top = itemTop(p);
      if (kind === 'phone') {
        return h(KScreen, Object.assign({ bottom: fb }, top), q,
          h(Keypad, { key: value + st, defaultValue: value, value: value, decimal: dec, result: result, hideKeys: !!result }));
      }
      return h(KScreen, top, h('div', { className: 'bt-split' },
        h('div', { className: 'bt-q', style: { flex: kind === 'phone-land' ? 0.34 : 0.4 } }, q),
        h('div', { className: 'bt-a', style: { flex: kind === 'phone-land' ? 0.66 : 0.6 } },
          h(Keypad, { key: value + st, value: value, decimal: dec, result: result, layout: 'side', hideKeys: !!result && kind === 'phone-land', after: kind === 'phone-land' ? fb : null }),
          kind === 'tablet' && fb)));
    },

    NumberLine: function (p) {
      var st = p.state || 'idle';
      var fb = st === 'idle' ? null : h(FeedbackPanel, { result: st === 'right' ? 'hit' : 'miss', why: '7 is one step before 8.' });
      return h(KScreen, Object.assign({ bottom: fb }, itemTop(p)),
        h('h1', { className: 'bt-prompt' }, 'Put 7 on the number line.'),
        h(NumberLine, { key: st, min: 0, max: 10, value: st === 'wrong' ? 8 : st === 'right' ? 7 : 4, answer: 7, revealed: st !== 'idle', label: 'Number line from 0 to 10' }));
    },

    Placement: function (p) {
      var step = p.step || 'intro';
      if (step === 'item') return Screens.Tap({ land: p.land, pause: true });
      if (step === 'pause') {
        return h(KScreen, { left: h(ReplayButton, { label: 'Good stopping spot! Your place is saved.' }), bottom: [
          h(KidButton, { key: 's', icon: 'home', label: 'Stop for now', variant: 'plain', showLabel: true }),
          h(KidButton, { key: 'g', icon: 'play', label: 'Keep going', showLabel: true })] },
          h('div', { className: 'bt-art' }, h('div', { className: 'bt-art-disc' }, h(Icon, { name: 'bookmark', stroke: 2 }))),
          h('h1', { className: 'bt-hero' }, 'Good stopping spot!'),
          h('p', { className: 'bt-lede' }, 'Your place is saved. Come back any time.'));
      }
      if (step === 'end') {
        return h(KScreen, { left: h(ReplayButton, { label: 'You found your spot on the trail!' }), bottom: h(KidButton, { icon: 'next', label: 'See my trail', showLabel: true, size: 'xl' }) },
          h('h1', { className: 'bt-hero' }, 'You found your spot!'),
          h('div', { className: 'bt-trailpanel', style: { flex: 'none' } }, h(TrailMap, { stops: TRAIL.slice(0, 5).map(function (s) { return s.state === 'review' ? { title: s.title, state: 'mastered' } : s; }), avatar: 'penguin', orientation: 'horizontal', height: 190 })),
          h('p', { className: 'bt-lede' }, 'Your trail is ready. Let’s walk it together.'));
      }
      return h(KScreen, { left: h(ReplayButton, { label: 'Let’s explore!' }), right: h(IconButton, { icon: 'home', label: 'Not now', variant: 'quiet' }), bottom: h(KidButton, { icon: 'play', label: 'Let’s go', showLabel: true, size: 'xl' }) },
        h(Avatar, { animal: 'penguin', size: S(150), decorative: true }),
        h('h1', { className: 'bt-hero' }, 'Let’s explore!'),
        h('p', { className: 'bt-lede' }, 'I’ll show you some puzzles. Some are easy, some are tricky. Every answer helps me find your spot.'));
    },

    CheckEnd: function (p) {
      var review = p.kind === 'review';
      if (p.result === 'retry') {
        return h(KScreen, { left: h(ReplayButton, { label: 'Almost there! Let’s look at the story again.' }), bottom: [
          h(KidButton, { key: 'l', icon: 'home', label: 'Later', variant: 'plain', showLabel: true }),
          h(KidButton, { key: 's', icon: 'book', label: 'Story again', showLabel: true })] },
          h('div', { className: 'bt-art' }, h('div', { className: 'bt-art-disc', style: { color: 'var(--hit-ink)', background: 'var(--hit-bg)' } }, h(Icon, { name: 'sprout', stroke: 1.8 }))),
          h('h1', { className: 'bt-hero' }, 'Almost there!'),
          h('p', { className: 'bt-lede' }, 'Let’s look at the story again, then try once more. Every try helps you grow.'));
      }
      return h(KScreen, { left: h(ReplayButton, { label: review ? 'Still got it!' : 'You did it! A new star for your trail.' }), bottom: h(KidButton, { icon: 'next', label: 'See my trail', showLabel: true, size: 'xl' }) },
        h('div', { className: 'bt-landing' }, h(Star), h('span', { className: 'bt-stone bt-stone-mastered', 'aria-hidden': 'true' })),
        h('h1', { className: 'bt-hero' }, review ? 'Still got it!' : 'You did it!'),
        h('p', { className: 'bt-lede' }, review ? 'Groups of 5 stays bright on your trail.' : 'Ten-frames is done. Your star is on the trail.'));
    },

    SessionEnd: function (p) {
      var n = p.stars != null ? p.stars : 3, stars = [];
      for (var i = 0; i < n; i++) stars.push(h(Star, { key: i }));
      return h(KScreen, { left: h(ReplayButton, { label: 'Great work today, Maya. See you tomorrow!' }), bottom: h(KidButton, { icon: 'home', label: 'Home', showLabel: true, size: 'xl' }) },
        h('div', { className: 'bt-art' }, h('div', { className: 'bt-art-disc', style: { background: 'var(--av-sky)' } }, h(Icon, { name: 'moon', stroke: 2 }))),
        h('h1', { className: 'bt-hero' }, 'See you tomorrow, Maya!'),
        n ? h('div', { className: 'bt-stars-row', role: 'img', 'aria-label': n + ' stars today' }, stars) : null,
        h('p', { className: 'bt-lede' }, n ? n + ' stars today. Your trail is getting brighter.' : 'You walked your trail today.'));
    },

    /* ---------- Parent zone ---------- */
    PinGate: function (p) {
      var mode = p.mode || 'enter';
      return h(ParentFrame, { back: 'Kids’ home', wide: p.land },
        h('div', { style: { flex: 1, display: 'flex', alignItems: 'center' } },
          h(PinPad, { key: mode + (p.value || '') + (p.error || ''), mode: mode, value: p.value || '', error: p.error })));
    },

    ParentHome: function (p) {
      var children = h(Section, { key: 'c', title: 'Children' }, p.empty
        ? h(EmptyState, { icon: 'plus', title: 'No children yet', body: 'Add a child to start their trail.', action: h(Button, { icon: 'plus' }, 'Add a child') })
        : [
          h(ParentRow, { key: 'm', leading: h(Avatar, { animal: 'penguin', size: '40px', decorative: true }), title: 'Maya', meta: 'Grade 1', chevron: true }),
          h(ParentRow, { key: 'l', leading: h(Avatar, { animal: 'dinosaur', size: '40px', decorative: true }), title: 'Leo', meta: 'Grade 5 · set by parent', chevron: true }),
          h(ParentRow, { key: 'a', leading: h(Icon, { name: 'plus' }), title: 'Add a child', action: true, onClick: function () {} })
        ]);
      var flags = h(Section, { key: 'f', title: 'Flagged content' },
        h(ParentRow, { leading: h(Icon, { name: 'flag' }), title: p.empty ? 'No open flags' : '2 open flags', meta: p.empty ? 'Kids can tap the flag on any card.' : 'Kids or grown-ups tapped “This looks wrong”.', trailing: p.empty ? null : h(Button, { variant: 'secondary', small: true }, 'See flags') }));
      var exp = h(Section, { key: 'e', title: 'Export', padded: true },
        h('p', { className: 'bt-p-text' }, 'Everything BrightTrail stores about your children, as one JSON file.'),
        h(Button, { variant: 'secondary', icon: 'share' }, 'Export all data'),
        p.exported ? h('p', { className: 'bt-status bt-status-ok', role: 'status' }, h(Icon, { name: 'check', stroke: 3 }), 'Exported 7 Nov 2026, 4:12 pm · brighttrail-export.json')
          : h('p', { className: 'bt-status' }, 'Not exported yet'));
      return h(ParentFrame, { back: 'Kids’ home', title: 'Grown-ups', wide: p.land },
        p.land ? h('div', { className: 'bt-pcols' }, h('div', null, children), h('div', null, flags, exp)) : [children, flags, exp]);
    },

    ChildForm: function (p) {
      var err = p.mode === 'error';
      var fields = [
        h(TextField, { key: 'n', label: 'First name', value: err ? 'Sam' : '', placeholder: 'e.g. Maya' }),
        h(AvatarPicker, { key: 'a', value: err ? 'frog' : 'fox', wide: p.land }),
        h(TextField, { key: 'b', label: 'Birthdate', value: err ? '2029-03-14' : '', placeholder: 'YYYY-MM-DD', inputMode: 'numeric', error: err ? 'That date is in the future. Check the year.' : null, hint: 'Sets the grade automatically.' }),
        h(ChipGroup, { key: 'g', label: 'School grade', value: 'auto', options: [{ value: 'auto', label: 'Auto (Grade 2)' }, 'K', '1', '2', '3', '4', '5', '6'].map(function (o) { return typeof o === 'string' ? { value: o, label: o === 'K' ? 'K' : 'Grade ' + o } : o; }), hint: 'Pick a grade only if the school placed them differently.' }),
        h(Toggle, { key: 't', label: 'Reading mode', hint: 'Narration starts off. For kids who read on their own.' }),
        h(Button, { key: 's', full: true }, 'Save')
      ];
      return h(ParentFrame, { back: 'Grown-ups', title: 'Add a child', wide: p.land },
        h('div', { className: 'bt-pnarrow' }, h(Section, { title: null, padded: true }, fields)));
    },

    ChildDetail: function (p) {
      var progress = h(Section, { key: 'p', title: 'Progress' },
        h(ParentRow, { leading: h(Icon, { name: 'tree' }), title: 'Skill tree', meta: '14 mastered · 1 review due', chevron: true }),
        h(ParentRow, { leading: h(Icon, { name: 'list' }), title: 'Placement review', meta: 'Placed 3 Nov 2026', chevron: true }));
      var profile = h(Section, { key: 'f', title: 'Profile', padded: true },
        h(TextField, { label: 'First name', value: 'Maya' }),
        h(AvatarPicker, { value: 'penguin' }),
        h(TextField, { label: 'Birthdate', value: '2019-05-02' }),
        h(ChipGroup, { label: 'School grade', value: 'auto', options: [{ value: 'auto', label: 'Auto (Grade 1)' }, { value: 'K', label: 'K' }, { value: '1', label: 'Grade 1' }, { value: '2', label: 'Grade 2' }, { value: '3', label: 'Grade 3' }] }),
        h(Toggle, { label: 'Reading mode', hint: 'Narration starts off. For kids who read on their own.' }),
        h(Button, { full: true }, 'Save changes'));
      var danger = h(Section, { key: 'd', title: 'Reset or delete', padded: true },
        h(ConfirmButton, { label: 'Reset progress', tone: 'danger', icon: 'refresh', question: 'Reset Maya’s progress?', consequence: 'Placement, stars and skill states are erased. The profile stays.', confirmLabel: 'Reset progress' }),
        h(ConfirmButton, { label: 'Delete Maya', tone: 'danger', icon: 'close', open: p.confirm, controlled: false, question: 'Delete Maya?', consequence: 'The profile and all progress leave this device for good. This can’t be undone.', confirmLabel: 'Delete Maya' }));
      return h(ParentFrame, { back: 'Grown-ups', title: 'Maya', wide: p.land },
        p.land ? h('div', { className: 'bt-pcols' }, h('div', null, progress, danger), h('div', null, profile)) : [progress, profile, danger]);
    },

    SkillTree: function (p) {
      var groups = [
        ['Kindergarten', [['Count to 10', 'B1.1', 'mastered'], ['Groups of 5', 'B1.3', 'review'], ['Compare small groups', 'B1.4', 'mastered']]],
        ['Grade 1', [['Count to 50', 'B1.1, B1.5', 'learning'], ['Ten-frames', 'B1.3', 'gap'], ['Teen numbers', 'B1.2', 'unknown'], ['Add within 10', 'B2.1, B2.2', 'assumed']]],
        ['Grade 2', [['Count to 200', 'B1.1', 'unknown'], ['Skip count by 2, 5, 10', 'B1.5', 'unknown']]]
      ];
      var seg = h('div', { className: 'bt-seg', role: 'group', 'aria-label': 'View' },
        h('button', { type: 'button', 'aria-pressed': p.view !== 'graph' }, h(Icon, { name: 'list' }), 'List'),
        h('button', { type: 'button', 'aria-pressed': p.view === 'graph' }, h(Icon, { name: 'tree' }), 'Tree'));
      var legend = h(Section, { key: 'lg', title: 'What the badges mean', action: seg }, p.land ? h(StateLegend, { inline: true }) : h(StateLegend));
      if (p.view === 'graph') {
        var nodes = [
          { id: 'a', title: 'Count to 10', state: 'mastered', x: 0, y: 40 }, { id: 'b', title: 'Groups of 5', state: 'review', x: 0, y: 150 }, { id: 'c', title: 'Compare small groups', state: 'mastered', x: 0, y: 260 },
          { id: 'd', title: 'Count to 50', state: 'learning', x: 270, y: 40 }, { id: 'e', title: 'Ten-frames', state: 'gap', x: 270, y: 150 }, { id: 'f', title: 'Teen numbers', state: 'unknown', x: 270, y: 260 }, { id: 'g', title: 'Add within 10', state: 'assumed', x: 270, y: 370 },
          { id: 'h', title: 'Count to 200', state: 'unknown', x: 560, y: 40 }, { id: 'i', title: 'Skip count by 2, 5, 10', state: 'unknown', x: 560, y: 150 }, { id: 'j', title: 'Add within 20', state: 'unknown', x: 560, y: 300 },
          { id: 'k', title: 'Place value to 100', state: 'unknown', x: 820, y: 150 }
        ];
        var edges = [['a', 'd'], ['a', 'e'], ['b', 'e'], ['b', 'g'], ['c', 'g'], ['d', 'h'], ['e', 'i'], ['f', 'j'], ['g', 'j'], ['h', 'k'], ['i', 'k']];
        return h(ParentFrame, { back: 'Maya', title: 'Skill tree', wide: true }, legend,
          h(Section, { title: 'Number · K to Grade 2', description: 'Arrows run from a skill to the skills it unlocks. Tap a skill for its curriculum codes.', padded: true },
            h(SkillGraph, { nodes: nodes, edges: edges, width: 1000, height: 430, nodeWidth: 180, columns: [{ x: 0, label: 'Kindergarten' }, { x: 270, label: 'Grade 1' }, { x: 560, label: 'Grade 2' }, { x: 820, label: 'Grade 3' }] })));
      }
      return h(ParentFrame, { back: 'Maya', title: 'Skill tree', wide: p.land }, legend,
        groups.map(function (g) {
          return h(Section, { key: g[0], title: g[0] }, g[1].map(function (r) { return h(ParentRow, { key: r[0], title: r[0], meta: r[1], trailing: h(StateBadge, { state: r[2] }) }); }));
        }));
    },

    PlacementReview: function (p) {
      var intro = h('p', { key: 'i', className: 'bt-p-text' }, 'Pick 10 skills and check each against what you know of your child. The bar is agreeing on 8 of 10.');
      if (p.empty) {
        return h(ParentFrame, { back: 'Maya', title: 'Placement review', wide: p.land }, intro,
          h(Section, { title: 'Placed skills' }, h(EmptyState, { icon: 'list', title: 'Placement hasn’t run yet.', body: 'It starts the first time Maya taps Let’s go on the trail.' })));
      }
      var rows = [
        ['Count to 10', 'Kindergarten', '4 of 4 right in placement', 'mastered'], ['Groups of 5', 'Kindergarten', '3 of 4 right in placement', 'mastered'],
        ['Compare small groups', 'Kindergarten', 'Not asked, assumed from grade', 'assumed'], ['Count to 50', 'Grade 1', '2 of 4 right in placement', 'learning'],
        ['Ten-frames', 'Grade 1', '1 of 4 right in placement', 'gap'], ['Add within 10', 'Grade 1', 'Not asked, assumed from grade', 'assumed'], ['Teen numbers', 'Grade 1', 'Not asked yet', 'unknown']
      ];
      return h(ParentFrame, { back: 'Maya', title: 'Placement review', wide: p.land }, intro,
        h(Section, { title: 'Placed skills', description: 'Placed 3 Nov 2026 over two sessions.' },
          rows.map(function (r) { return h(ParentRow, { key: r[0], title: r[0], meta: r[1] + ' · ' + r[2], trailing: h(StateBadge, { state: r[3] }) }); })));
    },

    Flags: function (p) {
      function card(f) {
        return h('div', { key: f.id, className: 'bt-card-pad', style: { borderTop: '1px solid var(--p-line)' } },
          h('div', null, h('div', { className: 'bt-row-title' }, f.type + ' · ' + f.skill), h('div', { className: 'bt-row-meta' }, 'Flagged by ' + f.by + ' · ' + f.when)),
          h('blockquote', { className: 'bt-quote' }, f.text),
          h('div', { className: 'bt-code' }, f.id),
          h('div', null, f.resolved ? h(Button, { variant: 'secondary', small: true, icon: 'refresh' }, 'Reopen') : h(Button, { variant: 'secondary', small: true, icon: 'check' }, 'Mark resolved')));
      }
      if (p.empty) {
        return h(ParentFrame, { back: 'Grown-ups', title: 'Flagged content', wide: p.land },
          h(Section, { title: 'Open' }, h(EmptyState, { icon: 'flag', title: 'No open flags', body: 'When someone taps “This looks wrong”, the card shows up here.' })));
      }
      var open = [
        { id: 'story.b1-3.card-4', type: 'Story card', skill: 'Ten-frames', by: 'Leo', when: '6 Nov 2026, 5:40 pm', text: 'A full ten-frame! Pip has ten fish.' },
        { id: 'item.b1-1.q-12', type: 'Question', skill: 'Count to 50', by: 'a grown-up', when: '5 Nov 2026, 7:02 pm', text: 'What number comes after 39?' }
      ];
      var done = [{ id: 'item.b1-5.q-03', type: 'Question', skill: 'Skip count by 5', by: 'Maya', when: '1 Nov 2026', text: 'Count by fives: 5, 10, 15, __', resolved: true }];
      var s1 = h(Section, { key: 'o', title: 'Open · 2' }, open.map(card));
      var s2 = h(Section, { key: 'r', title: 'Resolved · 1' }, done.map(card));
      return h(ParentFrame, { back: 'Grown-ups', title: 'Flagged content', wide: p.land }, p.land ? h('div', { className: 'bt-pcols' }, h('div', null, s1), h('div', null, s2)) : [s1, s2]);
    }
  };

  var ns = window.BrightTrail = window.BrightTrail || {};
  Object.assign(ns, {
    Icon: Icon, Star: Star, KidButton: KidButton, IconButton: IconButton, ReplayButton: ReplayButton, FlagButton: FlagButton, Button: Button,
    Avatar: Avatar, AvatarTile: AvatarTile, AvatarPicker: AvatarPicker, ANIMALS: ANIMALS, EmojiVisual: EmojiVisual, ChoiceTile: ChoiceTile,
    Keypad: Keypad, NumberLine: NumberLine, FeedbackPanel: FeedbackPanel, StoryCard: StoryCard, ProgressDots: ProgressDots, TrailMap: TrailMap,
    StateBadge: StateBadge, StateLegend: StateLegend, STATES: STATES, SkillGraph: SkillGraph, ParentFrame: ParentFrame, Section: Section,
    ParentRow: ParentRow, TextField: TextField, ChipGroup: ChipGroup, Toggle: Toggle, PinPad: PinPad, ConfirmButton: ConfirmButton,
    EmptyState: EmptyState, Loading: Loading, Device: Device, Board: Board, Screens: Screens
  });
})();
