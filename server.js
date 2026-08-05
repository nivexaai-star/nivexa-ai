const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { File } = require("node:buffer");

require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;

const HF_SPACE =
    "mediasynthesismuseum/stable-video-diffusion";

const HF_SPACE_URL =
    "https://mediasynthesismuseum-stable-video-diffusion.hf.space";

const folderHasil = path.join(
    __dirname,
    "generated"
);

/* ========================================
   KONFIGURASI DASAR SERVER
======================================== */

app.use(
    cors({
        origin: true,
        methods: [
            "GET",
            "POST",
            "OPTIONS"
        ]
    })
);

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(express.static(__dirname));

if (!fs.existsSync(folderHasil)) {
    fs.mkdirSync(folderHasil, {
        recursive: true
    });
}

app.use(
    "/generated",
    express.static(folderHasil)
);

/* ========================================
   KONFIGURASI UPLOAD FOTO
======================================== */

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter(req, file, callback) {
        if (!file.mimetype.startsWith("image/")) {
            return callback(
                new Error(
                    "File harus berupa gambar."
                )
            );
        }

        callback(null, true);
    }
});

/* ========================================
   CLIENT FAL.AI
======================================== */

let falClient = null;

async function dapatkanFalClient() {
    if (!falClient) {
        const { fal } =
            await import("@fal-ai/client");

        fal.config({
            credentials:
                process.env.FAL_KEY
        });

        falClient = fal;
    }

    return falClient;
}

/* ========================================
   FUNGSI BANTU VIDEO
======================================== */

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
            const hasil =
                cariUrlVideo(item);

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

        for (
            const kandidat
            of kandidatLangsung
        ) {
            if (
                typeof kandidat ===
                    "string" &&
                kandidat.length > 0
            ) {
                return kandidat;
            }
        }

        for (
            const nilai
            of Object.values(data)
        ) {
            const hasil =
                cariUrlVideo(nilai);

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

    return new URL(
        url,
        HF_SPACE_URL
    ).href;
}

async function unduhFile(
    url,
    lokasiTujuan
) {
    const respons = await fetch(url);

    if (!respons.ok) {
        throw new Error(
            "Gagal mengunduh hasil AI " +
            `(${respons.status}).`
        );
    }

    const arrayBuffer =
        await respons.arrayBuffer();

    fs.writeFileSync(
        lokasiTujuan,
        Buffer.from(arrayBuffer)
    );
}

/* ========================================
   HALAMAN UTAMA
======================================== */

app.get("/", function (req, res) {
    const halamanLogin = path.join(
        __dirname,
        "pages",
        "login.html"
    );

    if (fs.existsSync(halamanLogin)) {
        return res.sendFile(
            halamanLogin
        );
    }

    return res.json({
        success: true,
        message:
            "NIVEXA AI Server aktif."
    });
});

/* ========================================
   STATUS SERVER
======================================== */

app.get(
    "/status",
    function (req, res) {
        res.json({
            success: true,

            message:
                "Server NIVEXA AI aktif.",

            falKey:
                Boolean(
                    process.env.FAL_KEY
                ),

            huggingFaceToken:
                Boolean(
                    process.env.HF_TOKEN
                ),

            space: HF_SPACE
        });
    }
);

/* ========================================
   EDIT FOTO DENGAN FAL.AI
======================================== */

app.post(
    "/edit-photo",

    upload.single("photo"),

    async function (req, res) {
        try {
            if (!process.env.FAL_KEY) {
                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            "FAL_KEY belum terbaca " +
                            "di server Render."
                    });
            }

            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            "Foto belum dipilih."
                    });
            }

            const prompt = String(
                req.body.prompt || ""
            ).trim();

            if (!prompt) {
                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            "Tuliskan perubahan " +
                            "foto yang diinginkan."
                    });
            }

            console.log("");
            console.log(
                "================================"
            );
            console.log(
                "MEMULAI EDIT FOTO FAL.AI"
            );
            console.log(
                "Nama foto:",
                req.file.originalname
            );
            console.log(
                "Ukuran:",
                req.file.size,
                "bytes"
            );
            console.log(
                "Prompt:",
                prompt
            );
            console.log(
                "================================"
            );

            const fal =
                await dapatkanFalClient();

            const fileFoto = new File(
                [req.file.buffer],

                req.file.originalname ||
                    "foto.jpg",

                {
                    type:
                        req.file.mimetype ||
                        "image/jpeg"
                }
            );

            console.log(
                "Mengunggah foto ke fal.ai..."
            );

            const imageUrl =
                await fal.storage.upload(
                    fileFoto
                );

            console.log(
                "Foto berhasil diunggah."
            );

            console.log(
                "Memproses edit foto..."
            );

            const hasil =
                await fal.subscribe(
                    "fal-ai/flux-kontext/dev",
                    {
                        input: {
                            image_url:
                                imageUrl,

                            prompt:
                                prompt,

                            output_format:
                                "png"
                        },

                        logs: true,

                        onQueueUpdate(
                            update
                        ) {
                            if (
                                update.status ===
                                    "IN_PROGRESS" &&
                                Array.isArray(
                                    update.logs
                                )
                            ) {
                                update.logs
                                    .forEach(
                                        function (
                                            log
                                        ) {
                                            if (
                                                log.message
                                            ) {
                                                console.log(
                                                    "fal.ai:",
                                                    log.message
                                                );
                                            }
                                        }
                                    );
                            }
                        }
                    }
                );

            const hasilData =
                hasil?.data || hasil;

            const urlHasil =
                hasilData
                    ?.images?.[0]?.url ||
                hasilData
                    ?.image?.url ||
                hasilData
                    ?.image?.image_url;

            if (!urlHasil) {
                console.log(
                    "Respons Fal.ai:",
                    JSON.stringify(
                        hasilData,
                        null,
                        2
                    )
                );

                throw new Error(
                    "URL hasil Edit Foto " +
                    "tidak ditemukan."
                );
            }

            const namaFile =
                `nivexa-edit-${Date.now()}.png`;

            const lokasiFile =
                path.join(
                    folderHasil,
                    namaFile
                );

            console.log(
                "Mengunduh hasil Edit Foto..."
            );

            await unduhFile(
                urlHasil,
                lokasiFile
            );

            const alamatLokal =
                `/generated/${namaFile}`;

            console.log(
                "Edit Foto berhasil:",
                namaFile
            );

            return res.json({
                success: true,

                message:
                    "Foto berhasil diedit " +
                    "dengan Fal.ai.",

                imageUrl:
                    alamatLokal,

                fileName:
                    namaFile
            });
        } catch (error) {
            console.error("");
            console.error(
                "Kesalahan Edit Foto:",
                error
            );

            let pesan =
                error?.body?.detail ||
                error?.message ||
                "Edit Foto gagal diproses.";

            if (
                typeof pesan !== "string"
            ) {
                pesan =
                    JSON.stringify(pesan);
            }

            const pesanKecil =
                pesan.toLowerCase();

            if (
                pesanKecil.includes(
                    "credit"
                ) ||
                pesanKecil.includes(
                    "billing"
                ) ||
                pesanKecil.includes(
                    "payment"
                )
            ) {
                pesan =
                    "Saldo Fal.ai tidak " +
                    "tersedia atau tidak mencukupi.";
            }

            if (
                pesanKecil.includes(
                    "unauthorized"
                ) ||
                pesanKecil.includes(
                    "invalid key"
                ) ||
                pesanKecil.includes("401")
            ) {
                pesan =
                    "FAL_KEY tidak valid " +
                    "atau belum terbaca.";
            }

            return res
                .status(500)
                .json({
                    success: false,
                    message: pesan
                });
        }
    }
);

/* ========================================
   GENERATE VIDEO DENGAN HUGGING FACE
======================================== */

app.post(
    "/generate-video",

    upload.single("photo"),

    async function (req, res) {
        try {
            const prompt =
                typeof req.body.prompt ===
                "string"
                    ? req.body.prompt.trim()
                    : "";

            if (!process.env.HF_TOKEN) {
                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            "HF_TOKEN belum " +
                            "terbaca di server."
                    });
            }

            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            "Foto belum dipilih."
                    });
            }

            if (!prompt) {
                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            "Prompt gerakan " +
                            "belum diisi."
                    });
            }

            console.log("");
            console.log(
                "================================"
            );
            console.log(
                "MEMULAI PEMBUATAN VIDEO"
            );
            console.log(
                "Foto:",
                req.file.originalname
            );
            console.log(
                "Ukuran:",
                req.file.size,
                "bytes"
            );
            console.log(
                "Prompt:",
                prompt
            );
            console.log(
                "================================"
            );

            const {
                Client,
                handle_file
            } =
                await import(
                    "@gradio/client"
                );

            console.log(
                "Menghubungkan ke " +
                "Hugging Face Space..."
            );

            const gradioApp =
                await Client.connect(
                    HF_SPACE,
                    {
                        token:
                            process.env
                                .HF_TOKEN
                    }
                );

            const seed =
                Math.floor(
                    Math.random() *
                        2147483647
                );

            const randomizeSeed = true;
            const motionBucketId = 127;
            const framesPerSecond = 6;

            const imageBlob =
                new Blob(
                    [req.file.buffer],
                    {
                        type:
                            req.file
                                .mimetype
                    }
                );

            console.log(
                "Foto dikirim ke endpoint /video..."
            );

            const hasil =
                await gradioApp.predict(
                    "/video",
                    [
                        handle_file(
                            imageBlob
                        ),

                        seed,
                        randomizeSeed,
                        motionBucketId,
                        framesPerSecond
                    ]
                );

            console.log(
                "Respons Gradio diterima."
            );

            const urlMentah =
                cariUrlVideo(
                    hasil.data
                );

            if (!urlMentah) {
                console.log(
                    "Isi respons:",
                    JSON.stringify(
                        hasil.data,
                        null,
                        2
                    )
                );

                throw new Error(
                    "URL video tidak ditemukan " +
                    "dalam respons AI."
                );
            }

            const urlVideoAI =
                buatUrlLengkap(
                    urlMentah
                );

            const namaVideo =
                `nivexa-${Date.now()}.mp4`;

            const lokasiVideo =
                path.join(
                    folderHasil,
                    namaVideo
                );

            console.log(
                "Mengunduh video hasil AI..."
            );

            await unduhFile(
                urlVideoAI,
                lokasiVideo
            );

            const alamatVideo =
                `/generated/${namaVideo}`;

            console.log(
                "Video berhasil disimpan:",
                namaVideo
            );

            return res.json({
                success: true,

                message:
                    "Video AI berhasil dibuat.",

                videoUrl:
                    alamatVideo,

                fileName:
                    namaVideo,

                demo: false,

                info:
                    "Stable Video Diffusion " +
                    "menggerakkan foto tanpa " +
                    "membaca prompt secara langsung."
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
                pesanKecil.includes(
                    "queue"
                ) ||
                pesanKecil.includes(
                    "busy"
                ) ||
                pesanKecil.includes(
                    "capacity"
                ) ||
                pesanKecil.includes(
                    "rate limit"
                ) ||
                pesanKecil.includes(
                    "429"
                )
            ) {
                return res
                    .status(503)
                    .json({
                        success: false,

                        message:
                            "Server AI gratis " +
                            "sedang penuh atau antre. " +
                            "Silakan coba lagi."
                    });
            }

            if (
                pesanKecil.includes(
                    "401"
                ) ||
                pesanKecil.includes(
                    "unauthorized"
                ) ||
                pesanKecil.includes(
                    "token"
                )
            ) {
                return res
                    .status(401)
                    .json({
                        success: false,

                        message:
                            "Token Hugging Face " +
                            "tidak valid."
                    });
            }

            if (
                pesanKecil.includes(
                    "sleep"
                ) ||
                pesanKecil.includes(
                    "starting"
                )
            ) {
                return res
                    .status(503)
                    .json({
                        success: false,

                        message:
                            "Mesin AI sedang " +
                            "dinyalakan. Tunggu " +
                            "sebentar lalu coba lagi."
                    });
            }

            return res
                .status(500)
                .json({
                    success: false,
                    message: pesanAsli
                });
        }
    }
);

/* ========================================
   PENANGANAN ERROR
======================================== */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {
        console.error(
            "Kesalahan server:",
            error
        );

        if (
            error instanceof
                multer.MulterError &&
            error.code ===
                "LIMIT_FILE_SIZE"
        ) {
            return res
                .status(400)
                .json({
                    success: false,

                    message:
                        "Ukuran foto maksimal " +
                        "10 MB."
                });
        }

        return res
            .status(500)
            .json({
                success: false,

                message:
                    error.message ||
                    "Terjadi masalah pada server."
            });
    }
);

/* ========================================
   MENJALANKAN SERVER
======================================== */

app.listen(
    PORT,
    "0.0.0.0",

    function () {
        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "NIVEXA AI SERVER AKTIF"
        );
        console.log(
            "================================"
        );

        console.log(
            "HF token:",
            process.env.HF_TOKEN
                ? "sudah terbaca"
                : "belum terbaca"
        );

        console.log(
            "FAL key:",
            process.env.FAL_KEY
                ? "sudah terbaca"
                : "belum terbaca"
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `Status: http://localhost:${PORT}/status`
        );

        console.log(
            "================================"
        );
        console.log("");
    }
);
