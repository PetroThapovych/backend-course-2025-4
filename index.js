import { Command } from "commander";
import fs from "fs/promises";
import http from "http";
import { XMLBuilder } from "fast-xml-parser";

const program = new Command();

program
    .requiredOption("-i, --input <path>", "шлях до файлу для читання")
    .requiredOption("-h, --host <host>", "адреса сервера")
    .requiredOption("-p, --port <port>", "порт сервера");

program.parse(process.argv);
const options = program.opts();

// --------------------
// Перевірка існування файлу
// --------------------
try {
    await fs.access(options.input);
} catch {
    console.error("Cannot find input file");
    process.exit(1);
}

// --------------------
// HTTP-сервер
// --------------------
const server = http.createServer(async (req, res) => {
    try {
        const jsonData = await fs.readFile(options.input, "utf-8");
        const houses = JSON.parse(jsonData);

        const url = new URL(req.url, `http://${options.host}:${options.port}`);
        const furnishedParam = url.searchParams.get("furnished");
        const maxPriceParam = url.searchParams.get("max_price");

        let filtered = houses;
        if (furnishedParam === "true") {
            filtered = filtered.filter(
                (h) => h.furnishingstatus?.toLowerCase() === "furnished"
            );
        }
        if (maxPriceParam) {
            const max = parseFloat(maxPriceParam);
            if (!isNaN(max)) filtered = filtered.filter((h) => h.price < max);
        }

        const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
        const xmlData = builder.build({
            houses: {
                house: filtered.map(({ price, area, furnishingstatus }) => ({
                    price,
                    area,
                    furnishingstatus,
                })),
            },
        });

        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
        res.end(xmlData);
    } catch (err) {
        console.error("Помилка:", err.message);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
    }
});

server.listen(options.port, options.host, () => {
    console.log(`✅ Сервер запущено на http://${options.host}:${options.port}`);
});
