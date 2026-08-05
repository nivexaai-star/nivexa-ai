const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
let falClient = null;

async function dapatkanFalClient() {
    if (!falClient) {
        const { fal } = await import("@fal-ai/client");

        fal.config({
            credentials: process.env.FAL_KEY
        });

        falClient = fal;
    }

    return falClient;
}
const app = express();

const PORT = Number(process.env.PORT) || 3000;

const HF_SPACE =
    "mediasynthesismuseum/stable-video-diffusion";

const HF_SPACE_URL =
    "https://mediasynthesismuseum-stable-video-diffusion.hf.space";

const folderVideo = path.join(__dirname, "generated");

app.use(cors());
app.use(express.json());
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "pages", "login.html"));
});

app.use(express.static(__dirname));

if (!fs.existsSync(folderVideo)) {
    fs.mkdirSync(folderVideo, {
        recursive: true
    });
}

app.use("/generated", express.static(folderVideo));

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter(req, file, callback) {
        if (!file.mimetype.startsWith("image/")) {
            return callback(
                new Error("File harus berupa gambar.")
            );
        }

        callback(null, true);
    }
});
function cariUrlVideo(data) {
    if (!data) {
        return null;
    }

    if (typeof data === "string") {
        if (
            data.startsWith("http://") ||
            data.startsWith("https://") ||
            data.startsWith("/file=")
        ) {
            return data;
        }

        return null;
    }

    if (Array.isArray(data)) {
        for (const item of data) {
            const hasil = cariUrlVideo(item);

            if (hasil) {
                return hasil;
            }
        }

        return null;
    }

    if (typeof data === "object") {
        const kandidatLangsung = [
            data.url,
            data.video_url,
            data.download_url
        ];

        for (const kandidat of kandidatLangsung) {
            if (
                typeof kandidat === "string" &&
                kandidat.length > 0
            ) {
                return kandidat;
            }
        }

        for (const nilai of Object.values(data)) {
            const hasil = cariUrlVideo(nilai);

            if (hasil) {
                return hasil;
            }
        }
    }

    return null;
}

function buatUrlLengkap(url) {
    if (
        url.startsWith("http://") ||
        url.startsWith("https://")
    ) {
        return url;
    }

    return new URL(url, HF_SPACE_URL).href;
}

async function unduhVideo(url, lokasiTujuan) {
    const respons = await fetch(url);

    if (!respons.ok) {
        throw new Error(
            `Gagal mengunduh video hasil AI (${respons.status}).`
        );
    }

    const arrayBuffer = await respons.arrayBuffer();

    fs.writeFileSync(
        lokasiTujuan,
        Buffer.from(arrayBuffer)
    );
}

app.get("/status", function (req, res) {
    res.json({
        success: true,
        message: "Server NIVEXA AI aktif.",
        huggingFaceToken: Boolean(process.env.HF_TOKEN),
        falKey: Boolean(process.env.FAL_KEY),
        space: HF_SPACE
    });
});
app.post(
    "/edit-photo",
    upload.single("photo"),

    async function (req, res) {
        try {
            if (!process.env.FAL_KEY) {
                return res.status(500).json({
                    success: false,
                    message:
                        "FAL_KEY belum terbaca dari file .env."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Foto belum dipilih."
                });
            }

            const prompt =
                String(req.body.prompt || "").trim();

            if (!prompt) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Tuliskan perubahan foto yang diinginkan."
                });
            }

            console.log("");
            console.log("==============================");
            console.log("Memulai Edit Foto fal.ai");
            console.log("Foto:", req.file.originalname);
            console.log("Prompt:", prompt);
            console.log("==============================");

            const fal = await dapatkanFalClient();

            const fileFoto = new File(
                [req.file.buffer],
                req.file.originalname || "foto.jpg",
                {
                    type:
                        req.file.mimetype ||
                        "image/jpeg"
                }
            );

            console.log(
                "Mengunggah foto ke penyimpanan fal.ai..."
            );

            const imageUrl =
                await fal.storage.upload(fileFoto);

            console.log(
                "Foto berhasil diunggah:",
                imageUrl
            );

            console.log(
                "Mengirim permintaan Edit Foto ke fal.ai..."
            );

            const hasil = await fal.subscribe(
                "fal-ai/flux-kontext/dev",
                {
                    input: {
                        image_url: imageUrl,
                        prompt: prompt,
                        output_format: "png"
                    },

                    logs: true,

                    onQueueUpdate: function (update) {
                        if (
                            update.status === "IN_PROGRESS" &&
                            Array.isArray(update.logs)
                        ) {
                            update.logs.forEach(function (log) {
                                if (log.message) {
                                    console.log(
                                        "fal.ai:",
                                        log.message
                                    );
                                }
                            });
                        }
                    }
                }
            );

            const hasilData =
                hasil?.data || hasil;

            const urlHasil =
                hasilData?.images?.[0]?.url ||
                hasilData?.image?.url ||
                hasilData?.image?.image_url;

            if (!urlHasil) {
                console.log(
                    "Respons fal.ai:",
                    JSON.stringify(hasilData, null, 2)
                );

                throw new Error(
                    "URL hasil Edit Foto tidak ditemukan."
                );
            }

            const namaFile =
                "nivexa-edit-" +
                Date.now() +
                ".png";

            const lokasiFile = path.join(
                folderVideo,
                namaFile
            );

            console.log(
                "Mengunduh hasil Edit Foto..."
            );

            const responseGambar =
                await fetch(urlHasil);

            if (!responseGambar.ok) {
                throw new Error(
                    "Gagal mengunduh hasil Edit Foto."
                );
            }

            const bufferHasil = Buffer.from(
                await responseGambar.arrayBuffer()
            );

            fs.writeFileSync(
                lokasiFile,
                bufferHasil
            );

            console.log(
                "Edit Foto berhasil:",
                namaFile
            );

            return res.json({
    success: true,
    message:
        "Foto berhasil diedit dengan fal.ai.",

    imageUrl:
        `https://nivexa-ai-2.onrender.com/generated/${namaFile}`,

    fileName: namaFile
});
        } catch (error) {
            console.error("");
            console.error(
                "Kesalahan Edit Foto fal.ai:",
                error
            );

            let pesan =
                error?.body?.detail ||
                error?.message ||
                "Edit Foto gagal diproses.";

            if (typeof pesan !== "string") {
                pesan = JSON.stringify(pesan);
            }

            const pesanKecil =
                pesan.toLowerCase();

            if (
                pesanKecil.includes("credit") ||
                pesanKecil.includes("billing") ||
                pesanKecil.includes("payment")
            ) {
                pesan =
                    "Saldo fal.ai belum tersedia atau tidak mencukupi.";
            }

            if (
                pesanKecil.includes("unauthorized") ||
                pesanKecil.includes("invalid key") ||
                pesanKecil.includes("401")
            ) {
                pesan =
                    "FAL_KEY tidak valid atau belum terbaca.";
            }

            return res.status(500).json({
                success: false,
                message: pesan
            });
        }
    }
);
app.post(
    "/generate-video",
    upload.single("photo"),

    async function (req, res) {
        try {
            const prompt =
                typeof req.body.prompt === "string"
                    ? req.body.prompt.trim()
                    : "";

            if (!process.env.HF_TOKEN) {
                return res.status(500).json({
                    success: false,
                    message:
                        "HF_TOKEN belum terbaca dari file .env."
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Foto belum dipilih."
                });
            }

            if (!prompt) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Prompt gerakan belum diisi."
                });
            }

            console.log("");
            console.log("================================");
            console.log("Memulai pembuatan video NIVEXA AI");
            console.log("Foto:", req.file.originalname);
            console.log("Ukuran:", req.file.size, "bytes");
            console.log("Prompt:", prompt);
            console.log("================================");

            const {
                Client,
                handle_file
            } = await import("@gradio/client");

            console.log(
                "Menghubungkan ke Hugging Face Space..."
            );

            const gradioApp = await Client.connect(
                HF_SPACE,
                {
                    token: process.env.HF_TOKEN
                }
            );

            const seed = Math.floor(
                Math.random() * 2147483647
            );

            const randomizeSeed = true;

            // Nilai umum Stable Video Diffusion.
            const motionBucketId = 127;

            // Space menghasilkan sekitar 25 frame.
            const framesPerSecond = 6;

            const imageBlob = new Blob(
                [req.file.buffer],
                {
                    type: req.file.mimetype
                }
            );

            console.log(
                "Foto dikirim ke endpoint /video..."
            );

            const hasil = await gradioApp.predict(
                "/video",
                [
                    handle_file(imageBlob),
                    seed,
                    randomizeSeed,
                    motionBucketId,
                    framesPerSecond
                ]
            );

            console.log(
                "Respons Gradio diterima."
            );

            const urlMentah = cariUrlVideo(hasil.data);

            if (!urlMentah) {
                console.log(
                    "Isi respons:",
                    JSON.stringify(hasil.data, null, 2)
                );

                throw new Error(
                    "URL video tidak ditemukan dalam respons AI."
                );
            }

            const urlVideoAI =
                buatUrlLengkap(urlMentah);

            const namaVideo =
                `nivexa-${Date.now()}.mp4`;

            const lokasiVideo =
                path.join(folderVideo, namaVideo);

            console.log(
                "Mengunduh video hasil AI..."
            );

            await unduhVideo(
                urlVideoAI,
                lokasiVideo
            );

            const alamatVideoLokal =
                `/generated/${namaVideo}`;

            console.log(
                "Video berhasil disimpan:",
                namaVideo
            );

            return res.json({
                success: true,
                message:
                    "Video AI berhasil dibuat.",
                videoUrl: alamatVideoLokal,
                fileName: namaVideo,
                demo: false,

                info:
                    "Model Stable Video Diffusion saat ini " +
                    "menggerakkan foto tanpa membaca prompt " +
                    "secara langsung."
            });
        } catch (error) {
            console.error("");
            console.error(
                "Kesalahan pembuatan video:",
                error
            );

            const pesanAsli =
                error?.message ||
                "Video AI gagal dibuat.";

            const pesanKecil =
                pesanAsli.toLowerCase();

            if (
                pesanKecil.includes("queue") ||
                pesanKecil.includes("busy") ||
                pesanKecil.includes("capacity") ||
                pesanKecil.includes("rate limit") ||
                pesanKecil.includes("429")
            ) {
                return res.status(503).json({
                    success: false,
                    message:
                        "Server AI gratis sedang penuh atau " +
                        "antre. Silakan coba lagi beberapa saat."
                });
            }

            if (
                pesanKecil.includes("401") ||
                pesanKecil.includes("unauthorized") ||
                pesanKecil.includes("token")
            ) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Token Hugging Face tidak valid atau " +
                        "belum memiliki izin."
                });
            }

            if (
                pesanKecil.includes("sleep") ||
                pesanKecil.includes("starting")
            ) {
                return res.status(503).json({
                    success: false,
                    message:
                        "Mesin AI sedang dinyalakan. " +
                        "Tunggu sebentar lalu coba lagi."
                });
            }

            return res.status(500).json({
                success: false,
                message: pesanAsli
            });
        }
    }
);

app.use(function (error, req, res, next) {
    console.error(
        "Kesalahan server:",
        error
    );

    if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Ukuran foto maksimal 10 MB."
        });
    }

    return res.status(500).json({
        success: false,
        message:
            error.message ||
            "Terjadi masalah pada server."
    });
});

app.listen(
    PORT,
    "0.0.0.0",

    function () {
        console.log("");
        console.log("================================");
        console.log("NIVEXA AI SERVER AKTIF");
        console.log("================================");

        console.log(
            "HF token:",
            process.env.HF_TOKEN
                ? "sudah terbaca"
                : "belum terbaca"
        );

        console.log(
            `Server laptop: http://localhost:${PORT}`
        );

        console.log(
            `Tes status: http://localhost:${PORT}/status`
        );

        console.log("================================");
        console.log("");
    }
);