if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", type: "module" })
      .catch((error) => {
        console.error(
          "No se pudo registrar el service worker de GrownupsVet.",
          error,
        );
      });
  });
}
