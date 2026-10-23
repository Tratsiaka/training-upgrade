/* Слой хранения. Источник правды на устройстве — localStorage (работает офлайн).
   Синхронизация с базой (js/sync.js) подписывается на изменения через Store.onChange
   и кладёт пришедшие с сервера данные через Store.applyRemote — интерфейс приложения
   (get/set) от этого не меняется. */
(function () {
  "use strict";
  const NS = "upg3:";
  const mem = Object.create(null);
  const changeHandlers = [];
  const remoteHandlers = [];

  const localAdapter = {
    name: "local",
    load() {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(NS) === 0) {
            try { mem[k.slice(NS.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* битая запись — пропускаем */ }
          }
        }
      } catch (e) { /* приватный режим: работаем только в памяти */ }
    },
    save(k, v) {
      try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* нет места или приватный режим */ }
    }
  };

  let adapter = localAdapter;

  window.Store = {
    init() { adapter.load(); return Promise.resolve(); },
    get(k, d) { return k in mem ? mem[k] : d; },
    set(k, v) {
      mem[k] = v;
      adapter.save(k, v);
      changeHandlers.forEach((fn) => { try { fn(k, v); } catch (e) { console.error(e); } });
    },
    /** Записать значения, пришедшие с сервера, без повторной отправки на сервер. */
    applyRemote(values) {
      const keys = Object.keys(values);
      keys.forEach((k) => { mem[k] = values[k]; adapter.save(k, values[k]); });
      if (keys.length) remoteHandlers.forEach((fn) => { try { fn(keys); } catch (e) { console.error(e); } });
    },
    onChange(fn) { changeHandlers.push(fn); },
    onRemote(fn) { remoteHandlers.push(fn); },
    snapshot() { return JSON.parse(JSON.stringify(mem)); },
    setAdapter(a) { adapter = a; },
    get adapterName() { return adapter.name; }
  };
})();
