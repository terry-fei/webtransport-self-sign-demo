console.log("in client.js");

const endpoint = "localhost:4343";

async function connect() {
  const fingerprint = await fetch(`http://${endpoint}/fingerprint`, {
    method: "GET",
  }).then((res) => res.json());

  const certificateHash = new Uint8Array(fingerprint);

  const transport = new WebTransport(`https://${endpoint}`, {
    // requireUnreliable: true,
    // congestionControl: "default", // "low-latency" || "throughput"
    serverCertificateHashes: [
      {
        algorithm: "sha-256",
        value: certificateHash.buffer,
      },
    ],
  });

  transport.closed
    .then((_) => {
      console.log("WebTransport is closed");
    })
    .catch((e) => {
      console.log(e.toString());
    });

  transport.ready
    .then(async () => {
      console.log("WebTransport is ready");

      const datagramReader = transport.datagrams.readable.getReader();

      let isOpen = true;

      datagramReader.closed
        .catch((e) => console.log("Failed to close", e.toString()))
        .finally(() => (isOpen = false));

      while (isOpen) {
        try {
          const { done, value } = await datagramReader.read();
          if (done) {
            break;
          }

          console.log("Received datagram", value);
        } catch (e) {
          console.log("Failed to read...", e.toString());
          break;
        }
      }

      // const bidi = transport.createBidirectionalStream();
      // bidi.then((stream) => {
      //   const reader = stream.readable.getReader();
      //   reader.closed.catch(e => console.log("bidi readable closed", e.toString()));
      //   const writer = stream.writable.getWriter();
      //   writer.closed.catch(e => console.log("bidi writable closed", e.toString()));
      // });
      // bidi.catch(() => console.log("Failed to create bidirectional stream"));

      // readStream(transport.incomingBidirectionalStreams, "bidirectional");
      // readStream(transport.incomingUnidirectionalStreams, "unidirectional");
    })
    .catch((e) => {
      console.log(e.toString());
    })
    .finally(() => {
      console.log("transport.ready.finally() ...");
    });
}

connect();
