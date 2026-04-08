// Applies saved theme before first paint — prevents flash of wrong theme.
// Loaded as a plain <script> (not a module) in every page's <head>.
(function(){
  var t = localStorage.getItem('p2mt-theme');
  if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();
