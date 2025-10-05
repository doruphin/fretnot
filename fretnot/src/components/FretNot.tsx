/// <reference types="web-bluetooth" />
/// <reference types="node" />
import React, { useEffect, useMemo, useRef, useState } from "react";
import { recognize, type RecognizeResult } from "tesseract.js";
import { motion, AnimatePresence } from "framer-motion";
import "bootstrap-icons/font/bootstrap-icons.css";
import clsx from "clsx";
import Dropzone from "react-dropzone";

const FretNot: React.FC = () => {
	const [text, setText] = useState("");
	const [parsingImage, setParsingImage] = useState(false);
	const handleChange = (acceptedFiles: File[]) => {
		const path = URL.createObjectURL(acceptedFiles[0]);
		setParsingImage(true);
		resolveImage(path);
	};
	const resolveImage = (path: any) => {
		console.log(path);
		recognize(path, "eng", { logger: (m) => console.log(m) })
			.catch((err) => {
				console.error("ERROR", err);
			})
			.then((result) => {
				let text = (result as RecognizeResult).data.text;
				setText(text);
				setStage(stage + 1);
			});
	};
	const chordList = useMemo(() => {
		const filtered = text
			.split("\n")
			.filter((str) => str.at(0) !== "[" && str !== "Page 1/2")
			.splice(2)
			.filter((str, ind) => ind % 2 !== 0);
		return filtered.map((chord) => {
			if (chord == "Cc" || chord == "Cc E") {
				return "C";
			} else {
				return chord;
			}
		});
	}, [text]);
	const lyricsList = useMemo(() => {
		const filtered = text
			.split("\n")
			.filter((str) => str.at(0) !== "[" && str !== "Page 1/2")
			.splice(3);
		return filtered.filter((str, ind) => ind % 2 !== 0);
	}, [text]);
	const [chordPos, setChordPos] = useState(0);
	// UUIDs (must match your ESP32)
	const deviceName = "FretNot";
	const bleService = "19b10000-e8f2-537e-4f6c-d104768a1214";
	const chordCharacteristic = "19b10002-e8f2-537e-4f6c-d104768a1214";
	const [isIntervalRunning, setIsIntervalRunning] = useState(false);
	const [intervalTime, setIntervalTime] = useState(1000);
	const [sliderValue, setSliderValue] = useState(60);

	const [previewImage, setPreviewImage] = useState("mt_chords.png");

	useEffect(() => {
		let intervalId: NodeJS.Timeout | null = null;
		if (isIntervalRunning) {
			intervalId = setInterval(() => {
				console.log("Updating chordPos:", chordPos);
				if (chordPos < chordList.length - 1) {
					setChordPos((prevChordPos) => prevChordPos + 1);
				} else {
					setChordPos((prevChordPos) => 0);
				}
			}, 5500 - sliderValue); // Updates every `intervalTime` milliseconds
		}
		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	}, [chordList, chordPos, isIntervalRunning, intervalTime, sliderValue]);

	// Persistent references
	const bleServer = useRef<BluetoothRemoteGATTServer | null>(null);
	const bleServiceFound = useRef<BluetoothRemoteGATTService | null>(null);

	// Send the chord when the chord pos changes
	useEffect(() => {
		if (chordList.length > 0)
			writeOnCharacteristic(chordList[chordPos].toLowerCase());
	}, [chordPos]);

	// Check browser support
	const isWebBluetoothEnabled = (): boolean => {
		if (!navigator.bluetooth) {
			alert("Web Bluetooth API is not available in this browser!");
			return false;
		}
		console.log("✅ Web Bluetooth API supported.");
		return true;
	};

	// Connect to ESP32
	const connectToDevice = async () => {
		if (!isWebBluetoothEnabled()) return;
		console.log("🟦 Starting BLE connection flow...");
		try {
			const device = await navigator.bluetooth.requestDevice({
				filters: [{ name: deviceName }],
				optionalServices: [bleService],
			});
			console.log("✅ Device chosen:", device);
			device.addEventListener("gattservicedisconnected", onDisconnected);
			const gatt = await device.gatt?.connect();
			if (!gatt) throw new Error("❌ GATT connection returned null");
			console.log("✅ GATT connected:", gatt.device.name);
			bleServer.current = gatt;
			const service = await gatt.getPrimaryService(bleService);
			console.log("✅ Service found:", service.uuid);
			bleServiceFound.current = service;
			setStage(stage + 1);
		} catch (error: any) {
			console.error("💥 BLE connection failed:", error);
			alert("BLE connection failed: " + (error.message || error));
		}
	};

	// Write a chord to the ESP32
	const writeOnCharacteristic = async (value: string) => {
		try {
			if (!bleServer.current?.connected || !bleServiceFound.current)
				throw new Error("Bluetooth not connected.");
			console.log("✍️ Writing to chord characteristic...");
			const characteristic =
				await bleServiceFound.current.getCharacteristic(chordCharacteristic);
			const encoder = new TextEncoder();
			await characteristic.writeValue(encoder.encode(value));
			console.log("✅ Value written:", value);
		} catch (error) {
			console.error("⚠️ Write failed:", error);
		}
	};

	// Auto disconnect handler
	const onDisconnected = () => {
		console.warn("⚠️ Device disconnected automatically.");
	};

	const [stage, setStage] = useState(0);

	window.onbeforeunload = function (e) {
		writeOnCharacteristic("off");
	};

	const stages = [
		{
			id: 0,
			content: (
				<div className="flex flex-col items-center">
					<h1 className="text-3xl ">FretNot</h1>
					<h2 className="text-gray-700/70 italic">
						The Training Wheels for your Guitar
					</h2>
					<img
						src="favicon.ico"
						className="w-32 justify-self-center animate-bounce my-8"
						alt=""
					/>
					<button onClick={(_) => setStage(stage + 1)}>Get Started</button>
				</div>
			),
		},
		{
			id: 1,
			content: (
				<div className="items-center flex flex-col">
					<h1 className="text-3xl ">Let's get connected!</h1>
					<img src="bluetooth.png" alt="" className="w-32 mt-8" />
					<div className="mt-8">
						<button
							onClick={connectToDevice}
							className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
						>
							Link your FretNot
						</button>
					</div>
				</div>
			),
		},
		{
			id: 2,
			content: (
				<div className="flex flex-col items-center">
					<h1 className="text-3xl ">Try some chords!</h1>
					<img src={previewImage} alt="" />
					<div className="mt-4">
						{["C", "E", "F", "Fm"].map((chord) => (
							<button
								key={chord}
								disabled={!bleServer.current?.connected}
								className={
									"bg-blue-500 text-white px-4 py-2 rounded-full! hover:bg-blue-700 mr-2"
								}
								onClick={() => {
									writeOnCharacteristic(chord.toLowerCase());
									setPreviewImage(chord.toLowerCase() + "_chord.png");
								}}
							>
								{chord}
							</button>
						))}
					</div>
					<div className="mt-3">
						<button
							onClick={(_) => {
								setStage(stage + 1);
								writeOnCharacteristic("off");
							}}
						>
							It's showtime!
						</button>
					</div>
				</div>
			),
		},
		{
			id: 3,
			content: (
				<div className="flex flex-col items-center">
					<h1 className="text-3xl ">Upload some chords...</h1>
					<div className="mt-6">
						{parsingImage ? (
							<div className="flex flex-col items-center">
								<div role="status">
									<svg
										aria-hidden="true"
										className="w-16 h-16 text-gray-200 animate-spin dark:text-gray-600/30 fill-black"
										viewBox="0 0 100 101"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
											fill="currentColor"
										/>
										<path
											d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
											fill="currentFill"
										/>
									</svg>
								</div>
								<p className="text-gray-600 italic animate-pulse">
									Reticulating splines..
								</p>
							</div>
						) : (
							<Dropzone onDrop={handleChange}>
								{({ getRootProps, getInputProps }) => (
									<section className="flex-1 flex-col items-center p-4 border-2 rounded-lg transition-border duration-240 border-gray-300 bg-gray-200/20  text-gray-600 outline-none h-44 hover:cursor-pointer hover:border-dashed">
										<div
											{...getRootProps()}
											className="flex flex-col items-center"
										>
											<input {...getInputProps()} />
											<i className="bi bi-upload text-7xl mt-3" />
											<p className="mt-8">
												Drag 'n' drop an image of chords, or click to select
												file
											</p>
										</div>
									</section>
								)}
							</Dropzone>
						)}
					</div>
				</div>
			),
		},
		{
			id: 4,
			content: (
				<div>
					<div className="mt-8 text-center text-6xl font-bold">
						{chordList[chordPos]}
					</div>
					<div className="mt-2">
						<div className="text-center mt-8">
							<ul className="space-y-4 max-h-96 overflow-y-auto">
								{lyricsList.map((line, index) => (
									<li
										key={index}
										className={`transition-all duration-500 ease-in-out overflow-y-hidden ${
											index === chordPos ? "opacity-100" : "opacity-25"
										}`}
									>
										{line}
									</li>
								))}
							</ul>
						</div>
					</div>
					<div className="flex justify-center mt-3">
						<motion.div
							animate={{
								rotate: isIntervalRunning ? 180 : 0,
								scale: isIntervalRunning ? 1 : 1.1,
							}}
							transition={{ duration: 0.3 }}
						>
							<i
								className={clsx(
									"text-5xl hover:cursor-pointer overflow-hidden",
									isIntervalRunning
										? "bi bi-pause-circle-fill"
										: "bi bi-play-circle-fill"
								)}
								onClick={() => setIsIntervalRunning(!isIntervalRunning)}
							/>
						</motion.div>
					</div>

					<div className="flex justify-center accent-black">
						<input
							type="range"
							min="500"
							max="5000"
							value={sliderValue}
							onChange={(e) => setSliderValue(parseInt(e.target.value))}
							className="mt-4"
						/>
					</div>
					<div className="flex justify-center gap-x-24 text-gray-500/30">
						<i className="bi bi-play" />
						<i className="bi bi-fast-forward" />
					</div>
				</div>
			),
		},
	];

	return (
		<div className="flex flex-col items-center justify-center mt-10">
			<AnimatePresence mode="wait">
				<motion.div
					key={stage}
					initial={{ opacity: 0, x: 50 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -50 }}
					transition={{ duration: 0.4 }}
					className="text-xl p-8 rounded-2xl shadow-lg bg-white/70"
				>
					{stages[stage].content}
				</motion.div>
			</AnimatePresence>
		</div>
	);
};

export default FretNot;
