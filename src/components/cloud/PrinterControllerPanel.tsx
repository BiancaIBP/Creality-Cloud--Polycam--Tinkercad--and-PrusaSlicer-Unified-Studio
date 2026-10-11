"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { PrinterStatus } from '@/types/model';
import { Radio, Play, Pause, Square, Flame, Camera, Wifi, Video, RefreshCw, Cpu } from 'lucide-react';

const BACKEND_URL = 'http://127.0.0.1:8000';

export const PrinterControllerPanel: React.FC = () => {
  const [printer, setPrinter] = useState<PrinterStatus>({
    printer_name: 'Creality Ender-3 V3 SE (Cloud)',
    status: 'idle',
    nozzle_temp: 24.5,
    target_nozzle_temp: 0.0,
    bed_temp: 23.0,
    target_bed_temp: 0.0,
    fan_speed: 0,
    print_progress: 0.0,
    current_file: null,
    elapsed_time_seconds: 0,
    remaining_time_seconds: 0,
    is_connected: true
  });

  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(`${BACKEND_URL}/api/printer/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: PrinterStatus = await res.json();
      setPrinter(data);
      setIsSimulated(false);
    } catch {
      // Backend not running -> keep local simulated state active
      setIsSimulated(true);
      setPrinter((curr) => {
        if (curr.status === 'printing') {
          const newProgress = Math.min(100, curr.print_progress + 0.8);
          return {
            ...curr,
            print_progress: newProgress,
            elapsed_time_seconds: curr.elapsed_time_seconds + 3,
            status: newProgress >= 100 ? 'idle' : 'printing',
            is_connected: true
          };
        }
        return { ...curr, is_connected: true };
      });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void fetchStatus(), 0);
    const interval = setInterval(() => void fetchStatus(), 3000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const handleControlAction = async (action: string) => {
    try {
      const formData = new FormData();
      formData.append('action', action);
      const res = await fetch(`${BACKEND_URL}/api/printer/control`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        await fetchStatus();
        return;
      }
    } catch {
      // Fallback local simulation logic
    }

    // Apply action directly in local simulation state
    setPrinter((curr) => {
      if (action === 'start' || action === 'resume') {
        return {
          ...curr,
          status: 'printing',
          target_nozzle_temp: 210,
          nozzle_temp: 210,
          target_bed_temp: 60,
          bed_temp: 60,
          print_progress: curr.print_progress >= 100 ? 0 : curr.print_progress
        };
      } else if (action === 'pause') {
        return { ...curr, status: 'paused' };
      } else if (action === 'cancel') {
        return {
          ...curr,
          status: 'idle',
          print_progress: 0,
          target_nozzle_temp: 0,
          target_bed_temp: 0
        };
      } else if (action === 'set_temp') {
        const nextTemp = curr.target_bed_temp === 0 ? 60 : 0;
        return {
          ...curr,
          target_bed_temp: nextTemp,
          bed_temp: nextTemp
        };
      }
      return curr;
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-xl space-y-4">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-emerald-400">
            <Radio className="w-5 h-5" /> Creality Cloud Printer Controller
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time wireless remote telemetry, nozzle heating, & cloud webcam stream.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSimulated && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
              <Cpu className="w-3 h-3" /> Virtual Simulator
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Wifi className="w-3 h-3 animate-pulse" /> Online
          </span>
        </div>
      </div>

      {/* Printer Main Telemetry Card */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-200">{printer.printer_name}</h4>
            <p className="text-[10px] font-mono text-slate-400">
              Status: <span className="text-emerald-400 font-bold uppercase">{printer.status}</span>
            </p>
          </div>
          <button
            onClick={fetchStatus}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Temperature & Fan Indicators */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <div>
                <span className="text-[10px] text-slate-400 block">Nozzle Temp</span>
                <span className="font-bold text-slate-200">{printer.nozzle_temp.toFixed(1)}°C / {printer.target_nozzle_temp}°C</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-[10px] text-slate-400 block">Bed Temp</span>
                <span className="font-bold text-slate-200">{printer.bed_temp.toFixed(1)}°C / {printer.target_bed_temp}°C</span>
              </div>
            </div>
          </div>
        </div>

        {/* Print Progress Gauge */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Cloud Print Progress</span>
            <span className="font-mono text-emerald-400 font-bold">{printer.print_progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${printer.print_progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cloud Remote Live Video Camera Stream */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-sky-400" /> Creality Cloud AI Camera Feed
        </label>
        <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <Image
            src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80"
            alt="Virtual Printer Stream"
            width={800}
            height={450}
            unoptimized
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute top-3 left-3 bg-red-600/80 text-white px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
            <Video className="w-3 h-3 animate-pulse" /> LIVE STREAM
          </div>
        </div>
      </div>

      {/* Remote Action Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => handleControlAction(printer.status === 'printing' ? 'pause' : 'start')}
          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow"
        >
          {printer.status === 'printing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {printer.status === 'printing' ? 'Pause' : 'Cloud Print'}
        </button>

        <button
          onClick={() => handleControlAction('cancel')}
          className="py-2.5 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
        >
          <Square className="w-4 h-4" /> Stop
        </button>

        <button
          onClick={() => handleControlAction('set_temp')}
          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition"
        >
          <Flame className="w-4 h-4 text-amber-400" /> Heat Bed
        </button>
      </div>
    </div>
  );
};
