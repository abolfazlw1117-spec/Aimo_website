(function () {
  var d = document, h = d.documentElement, btn = d.getElementById("lang");
  var els = Array.prototype.slice.call(d.querySelectorAll("[data-en]"));
  var titles = { fa: d.title, en: "AIMO — Android App Developer" };
  els.forEach(function (e) { e.setAttribute("data-fa", e.textContent); });

  function setLang(l) {
    h.lang = l;
    h.dir = l === "fa" ? "rtl" : "ltr";
    els.forEach(function (e) { e.textContent = e.getAttribute("data-" + l); });
    d.title = titles[l];
    btn.textContent = l === "fa" ? "EN" : "فا";
    btn.setAttribute("aria-label", l === "fa" ? "Switch to English" : "تغییر به فارسی");
    try { localStorage.setItem("aimo-lang", l); } catch (err) {}
  }

  var saved = "fa";
  try { saved = localStorage.getItem("aimo-lang") || "fa"; } catch (err) {}
  if (saved === "en") setLang("en");
  btn.addEventListener("click", function () { setLang(h.lang === "fa" ? "en" : "fa"); });
  d.getElementById("y").textContent = new Date().getFullYear();
})();
