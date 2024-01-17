import { Http3Server } from "@fails-components/webtransport";
import { generateWebTransportCertificate } from "./cert";
import { createServer } from "http";
import path from "path";
import { existsSync, readFileSync } from "fs";
import mime from "mime";
import * as url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const HOST = "localhost";
const PORT = 4343;

async function main() {
  const certificate = await generateWebTransportCertificate(
    [
      { shortName: "C", value: "BR" },
      { shortName: "ST", value: "Rio Grande do Sul" },
      { shortName: "L", value: "Sapiranga" },
      { shortName: "O", value: "Pilar WebTransport" },
      { shortName: "CN", value: HOST },
    ],
    {
      days: 7,
    }
  );

  createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");

    const filename = req.url?.substring(1) || "index.html";

    if (filename === "fingerprint") {
      const fingerprint = certificate
        ?.fingerprint!.split(":")
        .map((hex) => parseInt(hex, 16));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fingerprint));
      return;
    }

    const filepath = path.join(__dirname, "client", filename);
    if (existsSync(filepath)) {
      res.writeHead(200, {
        "content-type": mime.getType(filename) || "text/plain",
      });
      res.end(readFileSync(filepath));
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  }).listen(PORT);

  const h3Server = new Http3Server({
    port: PORT,
    host: HOST,
    secret: "mysecret",
    cert: certificate?.cert,
    privKey: certificate?.private,
  });

  h3Server.startServer();

  console.log(
    'open "http://localhost:4343" in your browser, and open the console to see the logs.'
  );

  let isKilled: boolean = false;

  function handle(e: any) {
    console.log("SIGNAL RECEIVED:", e);
    isKilled = true;
    h3Server.stopServer();
  }

  process.on("SIGINT", handle);
  process.on("SIGTERM", handle);

  try {
    const sessionStream = h3Server.sessionStream("/");
    const sessionReader = sessionStream.getReader();
    sessionReader.closed.catch((e: any) =>
      console.log("session reader closed with error!", e)
    );

    while (!isKilled) {
      console.log("sessionReader.read() - waiting for session...");
      const { done, value } = await sessionReader.read();
      if (done) {
        console.log("done! break loop.");
        break;
      }

      value.closed
        .then(() => {
          console.log("Session closed successfully!");
        })
        .catch((e: any) => {
          console.log("Session closed with error! " + e);
        });

      value.ready
        .then(() => {
          console.log("session ready!");

          // reading datagrams
          const datagramReader = value.datagrams.readable.getReader();
          datagramReader.closed.catch((e: any) =>
            console.log("datagram reader closed with error!", e)
          );

          // writing datagrams
          const datagramWriter = value.datagrams.writable.getWriter();
          datagramWriter.closed
            .then(() => console.log("datagram writer closed successfully!"))
            .catch((e: any) =>
              console.log("datagram writer closed with error!", e)
            );
          datagramWriter.write(new Uint8Array([1, 2, 3, 4, 5]));
          datagramWriter.write(new Uint8Array([6, 7, 8, 9, 10]));
        })
        .catch((e: any) => {
          console.log("session failed to be ready!");
        });
    }
  } catch (e) {
    console.error("error:", e);

    // } finally {
    //   console.log("will stop the server!");
    //   // stop the server!
    //   h3Server.stopServer();
  }
}

main();
