import { createGooglePhotos } from "./google-photos.mjs";

export async function mountGooglePhotos(app, { port, beginImport, endImport }) {
  const photos = createGooglePhotos();
  await photos.init();
  const redirectUri = (req) =>
    `http://${req.hostname}:${port}/api/google-photos/oauth/callback`;
  app.get("/api/google-photos/status", (req, res) =>
    res.json({ ...photos.status(), redirectUri: redirectUri(req) }),
  );
  app.post("/api/google-photos/config", async (req, res) =>
    res.json(await photos.configure(req.body)),
  );
  app.post("/api/google-photos/oauth/start", (req, res) => {
    const auth = photos.beginAuth(redirectUri(req));
    res.cookie("cutroom_photos_state", auth.state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600000,
      path: "/api/google-photos/oauth/callback",
    });
    res.json({ url: auth.url });
  });
  app.get("/api/google-photos/oauth/callback", async (req, res) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("cutroom_photos_state="))
      ?.split("=")[1];
    res.clearCookie("cutroom_photos_state", {
      path: "/api/google-photos/oauth/callback",
      httpOnly: true,
      sameSite: "lax",
    });
    const escape = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    );
    try {
      await photos.completeAuth({ ...req.query, cookie });
      res
        .type("html")
        .send(
          '<!doctype html><meta name="viewport" content="width=device-width"><title>Google Photos connected · Cutroom</title><main style="font:18px system-ui;max-width:560px;margin:15vh auto;padding:24px"><h1>Google Photos connected.</h1><p>Return to the Cutroom tab and choose photos to import. You can close this tab.</p><a href="/">Return to Cutroom</a></main>',
        );
    } catch (e) {
      res
        .status(400)
        .type("html")
        .send(
          `<!doctype html><title>Google Photos connection · Cutroom</title><main style="font:18px system-ui;max-width:560px;margin:15vh auto;padding:24px"><h1>Connection needs attention</h1><p>${escape(e.message)}</p><a href="/">Return to Cutroom and try again</a></main>`,
        );
    }
  });
  app.post("/api/google-photos/disconnect", async (_req, res) =>
    res.json(await photos.disconnect()),
  );
  app.post("/api/google-photos/sessions", async (_req, res) =>
    res.json(await photos.createSession()),
  );
  app.get("/api/google-photos/session", async (_req, res) =>
    res.json(await photos.poll()),
  );
  app.post("/api/google-photos/import", (_req, res) => {
    if (!photos.status().session?.ready)
      return res
        .status(409)
        .json({ error: "Finish choosing photos in Google Photos first." });
    beginImport();
    photos
      .importPicked()
      .catch(() => {})
      .finally(endImport);
    res.status(202).json(photos.status());
  });
  return photos;
}
