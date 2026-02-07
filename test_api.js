const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function test() {
    try {
        const res = await fetch("http://localhost:3000/api/creative/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                clientId: "bgSgwWB7Qutcs8SNa3bP",
                adId: "120238662388150623",
                range: "last_14d"
            })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
