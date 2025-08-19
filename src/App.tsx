import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "./audio/engine";
import { useDragAndDrop } from "./hooks/useDragAndDrop";

export default function App() {
  const [speed, setSpeed] = useState(0.87);
  const [reverbVolume, setReverbVolume] = useState(0.0);
  const [reverbLength, setReverbLength] = useState(2.0);
  const [filename, setFilename] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>();
  const [busy, setBusy] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Your original logic is preserved
  const regenerate = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setAudioUrl(undefined); // Clear previous audio
    const blob = await Engine.renderWav();
    if (blob) {
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    }
    setBusy(false);
  }, [busy]);

  useEffect(() => {
    Engine.setPlaybackRate(speed);
  }, [speed]);
  useEffect(() => {
    Engine.setReverbVolume(reverbVolume);
  }, [reverbVolume]);
  useEffect(() => {
    Engine.setReverbLength(reverbLength);
  }, [reverbLength]);

  const onFile = useCallback(
    async (file?: File) => {
      if (!file || busy) return;
      setFilename((file.name || "output").replace(/\.[^/.]+$/, ""));
      await Engine.load(file);
      await regenerate();
    },
    [busy, regenerate]
  );

  const { isDragging, ...dragHandlers } = useDragAndDrop(onFile);

  const handleFileClick = () => {
    console.log(`${fileInputRef.current}`);
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-2xl bg-gray-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-gray-200 border border-gray-700/50">
        {/* Header */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="hidden"
        />
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Slowed + Reverb</h1>
          <p className="text-gray-400 mt-1">Audio Effects Generator</p>
        </div>

        {/* File Upload Area */}
        {!audioUrl && !busy && (
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-300 ${
              isDragging
                ? "border-blue-500 bg-gray-700/50"
                : "border-gray-600 hover:border-gray-500"
            }`}
            {...dragHandlers}
          >
            <div className="flex flex-col items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-500 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <p className="text-gray-400 mb-2">
                Drag & drop your audio file here
              </p>
              <p className="text-gray-500 text-sm mb-4">or</p>
              <button
                onClick={handleFileClick}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer py-2 px-4 rounded-lg transition-transform duration-200 ease-in-out hover:scale-105"
              >
                Click to Upload
              </button>
            </div>
          </div>
        )}

        {/* Controls & Player Section */}
        {(audioUrl || busy || filename) && (
          <div>
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6 text-center">
              <p className="text-gray-400 text-sm">Original File</p>
              <p className="font-mono truncate">{filename || "..."}</p>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Speed Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <label className="font-semibold">Speed</label>
                  <span className="text-sm font-mono bg-gray-900/50 px-2 py-1 rounded">
                    {Math.round(speed * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.25}
                  step={0.01}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  onMouseUp={regenerate}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <label className="font-semibold">Reverb Length</label>
                  <span className="text-sm font-mono bg-gray-900/50 px-2 py-1 rounded">
                    {Math.round(reverbVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={reverbVolume}
                  onChange={(e) => setReverbVolume(parseFloat(e.target.value))}
                  onMouseUp={regenerate}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
                />
              </div>
              {/* Reverb Size Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <label className="font-semibold">Reverb Size</label>
                  <span className="text-sm font-mono bg-gray-900/50 px-2 py-1 rounded">
                    {reverbLength.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.1}
                  value={reverbLength}
                  onChange={(e) => setReverbLength(parseFloat(e.target.value))}
                  onMouseUp={regenerate}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg accent-blue-500"
                />
              </div>
            </div>

            {/* Player and Status */}
            <div className="h-16 flex items-center justify-center">
              {busy ? (
                <div className="flex items-center space-x-3">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span className="text-lg text-gray-400">Processing...</span>
                </div>
              ) : (
                audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    className="w-full"
                  />
                )
              )}
            </div>
            <div className="text-center mt-4">
              <button
                onClick={handleFileClick}
                className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition-colors cursor-pointer"
              >
                Upload a different file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
