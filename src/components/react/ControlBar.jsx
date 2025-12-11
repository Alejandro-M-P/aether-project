import React, { useState, useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";

// CONSTANTE para la privacidad
const RANDOM_RADIUS_DEGREE = 0.05;

// Offset Aleatorio
const addRandomOffset = (location) => {
	const newLocation = { ...location };
	const angle = Math.random() * 2 * Math.PI;
	const distance = Math.random() * RANDOM_RADIUS_DEGREE;
	newLocation.lat += distance * Math.cos(angle);
	newLocation.lon += distance * Math.sin(angle);
	return newLocation;
};

// Ubicación precisa
const getPreciseLocation = () => {
	return new Promise((resolve) => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					});
				},
				(error) => {
					console.warn("Error geolocalización:", error);
					resolve(null);
				},
				{ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
			);
		} else {
			resolve(null);
		}
	});
};

// Reverse Geocoding
const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, { headers: { "Accept-Language": "es" } });
		const data = await response.json();
		const address = data.address;
		if (address) {
			const city = address.city || address.town || address.village || address.municipality;
			const country = address.country;
			return { cityName: city || null, countryName: country || null };
		}
		return { cityName: null, countryName: null };
	} catch (error) {
		console.error("Error Geocoding:", error);
		return { cityName: null, countryName: null };
	}
};

// Renderizado cliente-only para iconos (evita mismatches SSR y define Search)
const ClientIcon = ({ name, ...props }) => {
	const [isClient, setIsClient] = React.useState(false);
	React.useEffect(() => setIsClient(true), []);
	if (!isClient) return <span aria-hidden="true" style={{ display: "inline-block", width: props.width || 16, height: props.height || 16 }} />;

	const IconComp = Icons[name] || Icons.Activity || (() => null);
	return <IconComp {...props} />;
};

// Garantiza que <Search /> exista (usa el wrapper cliente)
const Search = (props) => <ClientIcon name="Search" {...props} />;

// Agregar aliases para todos los iconos usados en el archivo (evita "X is not defined", "Send is not defined", etc.)
const X = (props) => <ClientIcon name="X" {...props} />;
const Radio = (props) => <ClientIcon name="Radio" {...props} />;
const Send = (props) => <ClientIcon name="Send" {...props} />;
const Activity = (props) => <ClientIcon name="Activity" {...props} />;

export default function ControlBar() {
	const $searchQuery = useStore(searchQuery);
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [isSending, setIsSending] = useState(false);
	
	// Estado para controlar qué sección está expandida
	// false = Transmitir Grande (Default)
	// true = Buscar Grande
	const [isSearchExpanded, setIsSearchExpanded] = useState(false);
	const inputRef = useRef(null);

	// Cerrar búsqueda expandida si se hace clic fuera o se presiona Escape
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.key === "Escape" && isSearchExpanded) {
				setIsSearchExpanded(false);
				inputRef.current?.blur();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isSearchExpanded]);

	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;

		const user = auth.currentUser;
		if (!user) {
			alert("Debes conectarte (botón arriba derecha) para transmitir.");
			return;
		}

		setIsSending(true);
		let preciseLocation = await getPreciseLocation();
		let randomizedLocation = null;
		let geoNames = { cityName: null, countryName: null };

		if (preciseLocation) {
			randomizedLocation = addRandomOffset(preciseLocation);
			geoNames = await reverseGeocode(randomizedLocation.lat, randomizedLocation.lon);
		}

		try {
			const thoughtData = {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
				uid: user.uid,
				photoURL: user.photoURL,
				displayName: user.displayName,
			};

			if (randomizedLocation) {
				thoughtData.location = randomizedLocation;
				thoughtData.cityName = geoNames.cityName;
				thoughtData.countryName = geoNames.countryName;
			}

			await addDoc(collection(db, "thoughts"), thoughtData);
			setMsg("");
			setCat("");
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<>
			{/* FOOTER */}
			<footer className="fixed bottom-8 left-0 right-0 z-50 w-full px-4 pointer-events-none flex justify-center">
				<div className="pointer-events-auto flex items-center gap-2 bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-full p-2 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-500 w-full max-w-xl ring-1 ring-white/5">
					
					{/* SECCIÓN DE BÚSQUEDA */}
					<div 
						className={`
							relative flex items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden rounded-full
							${isSearchExpanded 
								? "flex-[4] bg-white/5 border border-white/10 px-4" // Expandido
								: "w-12 h-12 justify-center bg-transparent border border-transparent hover:bg-white/5 cursor-pointer" // Colapsado
							}
						`}
						onClick={() => {
							if (!isSearchExpanded) {
								setIsSearchExpanded(true);
								setTimeout(() => inputRef.current?.focus(), 100);
							}
						}}
					>
						<Search 
							className={`
								shrink-0 transition-colors duration-300
								${isSearchExpanded ? "w-4 h-4 text-white/50" : "w-5 h-5 text-white/70"}
							`} 
						/>
						
						<input
							ref={inputRef}
							type="text"
							value={$searchQuery}
							onChange={(e) => searchQuery.set(e.target.value)}
							className={`
								bg-transparent border-none text-white text-sm font-mono placeholder-white/30 focus:outline-none h-12 ml-3 w-full
								transition-opacity duration-300
								${isSearchExpanded ? "opacity-100 visible" : "opacity-0 invisible w-0 p-0 m-0"}
							`}
							placeholder="Filtrar frecuencia..."
							onBlur={() => {
								if (!$searchQuery) setIsSearchExpanded(false);
							}}
						/>

						{isSearchExpanded && $searchQuery && (
							<button onClick={(e) => { e.stopPropagation(); searchQuery.set(""); }} className="text-white/30 hover:text-white">
								<X size={14} />
							</button>
						)}
					</div>

					{/* Separador Visual (solo si ambos tienen cierto tamaño, opcional) */}
					<div className="w-px h-6 bg-white/10 mx-1 shrink-0"></div>

					{/* SECCIÓN DE TRANSMISIÓN (BOTÓN PRINCIPAL) */}
					<button
						onClick={() => {
							setOpen(true);
							// Si abrimos transmitir, colapsamos búsqueda si está vacía
							if (!$searchQuery) setIsSearchExpanded(false);
						}}
						className={`
							relative flex items-center justify-center gap-3 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-full border border-white/10 overflow-hidden group hover:border-emerald-500/30
							${isSearchExpanded 
								? "w-12 h-12 bg-zinc-900" // Colapsado (cuando búsqueda está activa)
								: "flex-[4] h-12 bg-zinc-900 hover:bg-zinc-800" // Expandido (Default)
							}
						`}
					>
						{/* Fondo animado */}
						<div className={`absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isSearchExpanded ? 'hidden' : 'block'}`}></div>

						{isSearchExpanded ? (
							<Radio className="w-5 h-5 text-emerald-500 shrink-0" />
						) : (
							<>
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
								</span>
								<span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-white shrink-0 whitespace-nowrap">
									Transmitir Señal
								</span>
							</>
						)}
					</button>

				</div>
			</footer>

			{/* MODAL DE TRANSMISIÓN (Mejorado estéticamente) */}
			{open && (
				<div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-6 animate-in fade-in duration-200">
					<div className="w-full max-w-lg relative animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
						
						<div className="bg-zinc-950 border border-white/10 rounded-3xl p-1 shadow-2xl ring-1 ring-white/5">
							<div className="bg-zinc-900/50 rounded-[1.3rem] p-8 border border-white/5 relative overflow-hidden">
								
								{/* Decoración de fondo */}
								<div className="absolute top-0 right-0 p-4 opacity-10">
									<Radio size={100} strokeWidth={0.5} />
								</div>

								<div className="flex justify-between items-start mb-8 relative z-10">
									<div>
										<h2 className="text-white font-mono text-sm font-bold tracking-[0.2em] uppercase flex items-center gap-2">
											<span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
											Nueva Transmisión
										</h2>
										<p className="text-zinc-500 text-[10px] font-mono mt-1 ml-3">SECURE CHANNEL // ENCRYPTED</p>
									</div>
									<button
										onClick={() => setOpen(false)}
										className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
									>
										<X size={20} />
									</button>
								</div>

								<form onSubmit={send} className="flex flex-col gap-4 relative z-10">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider ml-1">Frecuencia / Categoría</label>
										<input
											value={cat}
											onChange={(e) => setCat(e.target.value)}
											placeholder="EJ: PENSAMIENTO, AMOR, DUDA..."
											className="w-full bg-zinc-950/50 border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-mono tracking-wide focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder-zinc-700"
										/>
									</div>
									
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider ml-1">Mensaje</label>
										<textarea
											value={msg}
											onChange={(e) => setMsg(e.target.value)}
											className="w-full bg-zinc-950/50 border border-white/10 rounded-xl p-4 text-white text-base font-light resize-none placeholder-zinc-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 h-40 leading-relaxed transition-all"
											placeholder="Escribe al vacío..."
											maxLength={280}
											autoFocus
										/>
										<div className="flex justify-end">
											<span className={`text-[10px] font-mono ${msg.length > 250 ? 'text-red-400' : 'text-zinc-600'}`}>
												{msg.length} / 280
											</span>
										</div>
									</div>

									<button
										disabled={isSending}
										className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 py-4 rounded-xl text-xs font-mono font-bold tracking-[0.2em] uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 group flex items-center justify-center gap-3"
									>
										{isSending ? (
											<span className="animate-pulse">Enviando Señal...</span>
										) : (
											<>
												Enviar Señal <Send size={14} className="group-hover:translate-x-1 transition-transform" />
											</>
										)}
									</button>
								</form>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}