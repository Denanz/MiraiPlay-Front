/* Вставляется в <head> Tizen-сборки раньше всех остальных скриптов (см. vite.config.ts).
 * Chromium 63 не понимает rgb(r g b / a), поэтому в Tizen-CSS цвета записаны как
 * rgba(var(--accent-rgb), a) и переменные --*-rgb должны быть через запятую.
 * Код темы пишет их через пробел; переводим на лету, не трогая остальной код. */
(function () {
  var proto = CSSStyleDeclaration.prototype;
  var set = proto.setProperty;
  proto.setProperty = function (name, value, priority) {
    if (typeof name === 'string' && /^--[\w-]*-rgb$/.test(name) && typeof value === 'string') {
      value = value.trim().split(/[\s,]+/).join(', ');
    }
    return set.call(this, name, value, priority);
  };
  document.documentElement.className += ' tv';
})();
