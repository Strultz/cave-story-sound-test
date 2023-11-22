import { Lazy } from "./utils/Lazy.js"
import { OrganyaMusicPlayer } from "./organya/OrganyaMusicPlayer.js"
//import type { OrganyaSong } from "./organya/OrganyaSong.js"
import { readOrganyaSong } from "./organya/readOrganyaSong.js"

const audioContext = new Lazy(() => new AudioContext({ latencyHint: "interactive" }))

// Init music controls.

const musicControlsTemplate = document.getElementById("music-controls-template") as HTMLTemplateElement
const musicControlsClone = musicControlsTemplate.content.cloneNode(true) as DocumentFragment
const musicControls = musicControlsClone.firstElementChild as HTMLFormElement
const musicStatus = musicControls.querySelector<HTMLSpanElement>(".status")!
const musicOptions = musicControls.querySelector<HTMLInputElement>(".options")!
const musicStop = musicControls.querySelector<HTMLInputElement>(".stop")!

const melodyWaveformData = await (async () => {
  const res = await fetch(new URL("data/WAVE/WAVE100", import.meta.url))
  if (!res.ok) {
    throw new Error("Failed to fetch melody waveform data.")
  }

  return await res.arrayBuffer()
})()

const percussionSamples: (AudioBuffer | undefined)[] = []

const percussionNames = [
  "BASS01",
"BASS02",
"SNARE01",
"SNARE02",
"TOM01", 

"HICLOSE",
"HIOPEN",
"CRASH",
"PER01",
"PER02", 

"BASS03",
"TOM02",
"BASS04",
"BASS05",
"SNARE03", 

"SNARE04",
"HICLOSE02",
"HIOPEN02",
"HICLOSE03",
"HIOPEN03", 

"CRASH02",
"REVSYM01",
"RIDE01",
"TOM03",
"TOM04", 

"ORCDRM01",
"BELL",
"CAT" ,
"BASS06",
"BASS07", 

"SNARE05",
"SNARE06",
"SNARE07",
"TOM05",
"HIOPEN04", 

"HICLOSE04",
"CLAP01",
"PESI01",
"QUICK01",
"BASS08" , 

"SNARE08",
"HICLOSE05",
]

//await (async () => {
async function loadWav(name: string): Promise<AudioBuffer | undefined> {
  const res = await fetch(new URL(`./data/WAVE/${name}`, import.meta.url))
  if (!res.ok) {
    document.body.innerHTML = name
    throw new Error("Failed to fetch percussion waveform data.")
  }
  const buf = await res.arrayBuffer()
  const view = new DataView(buf)
  const i8a = new Uint8Array(buf)
  let i = 0
  const riffc = view.getUint32(i, true); i += 8 // skip
  if (riffc != 0x46464952) { // 'RIFF'
    throw new Error(`Invalid RIFF ${name}`)
  }
  const wavec = view.getUint32(i, true); i += 4
  if (wavec != 0x45564157) { // 'WAVE'
    throw new Error(`Invalid WAVE ${name}`)
  }

  const riffId = view.getUint32(i, true); i += 8 // skip
  //const riffLen = view.getUint32(i, true); i += 4
  if (riffId != 0x20746d66) { // 'fmt '
    throw new Error(`Invalid fmt  ${name}`)
    // return undefined
  }

  //const startPos = i
  const aFormat = view.getUint16(i, true); i += 2
  if (aFormat != 1) {
    throw new Error(`Invalid format ${name}`)
    //return undefined
  }

  const channels = view.getUint16(i, true); i += 2
  const samples = view.getUint32(i, true); i += 10 // skip
  const bits = view.getUint16(i, true); i += 2

  if (view.getUint32(i + 2, true) == 0x74636166) { // 'fact'
    i += 6;
    i += view.getUint32(i, true); i += 4;
  }
  
  const wavData = view.getUint32(i, true); i += 4
  const wavLen = view.getUint32(i, true); i += 4

  if (wavData != 0x61746164) { // 'data'
    throw new Error(`Invalid data ${name}`)
  }
    
  const mdb = (2 ** bits) / 2
  const audioBuffer = new AudioBuffer({ numberOfChannels: channels, length: wavLen / channels, sampleRate: samples })
  for (let j = 0; j < wavLen; j += channels) {
    for (let k = 0; k < channels; k++) {
      const channelBuffer = audioBuffer.getChannelData(k)
      channelBuffer[j / channels] = (i8a[i + j + k]! - mdb) / mdb
    }
  }
  return audioBuffer
  // return audioContext.value.decodeAudioData()
}

for (let i = 0; i < percussionNames.length; i++) {
  percussionSamples[i] = await loadWav(percussionNames[i]!);
}
//})()

/*const percussionSamples = [
  sfxSamples.get("150"),
  sfxSamples.get("151"),
  sfxSamples.get("152"),
  sfxSamples.get("153"),
  sfxSamples.get("154"),
  sfxSamples.get("155"),
]*/

const musicPlayer = new Lazy<OrganyaMusicPlayer>(() => {
  const musicPlayer = new OrganyaMusicPlayer(audioContext.value, melodyWaveformData, percussionSamples)

  const gainNode = audioContext.value.createGain()
  gainNode.gain.value = .75
  musicPlayer.connect(gainNode)
  gainNode.connect(audioContext.value.destination)

  function updateStatusText() {
    musicStatus.textContent = musicPlayer.position.toFixed(3)
    requestAnimationFrame(updateStatusText)
  }
  updateStatusText()

  return musicPlayer
})

//const songCache = new Map<string, OrganyaSong>()

function setSelectedSong(): void {
  const selectedSongFile = musicOptions.files![0]
  //let song = songCache.get(selectedSongKey)
  //if (song == undefined) {
  const reader = new FileReader()
  reader.onload = function() {
    /*const res = await fetch(new URL(`./data/ORG/${selectedSongKey}`, import.meta.url))
    if (!res.ok) {
      throw new Error("Failed to fetch Organya song.")
    }*/
    const song = readOrganyaSong(reader.result as ArrayBuffer, (level, message) => {
      if (level === "warning") {
        console.warn(message)
      } else {
        console.error(message)
      }
    })
    // In Cave Story, percussion instrument types are fixed (unlike in other Organya implementations), so we need to
    // modify the percussion tracks to get the expected sounds.
    //for (let i = 8; i < song.tracks.length; i++) {
      //;(song.tracks[i] as { instrument: number }).instrument = i - 8
    //}
    //songCache.set(selectedSongKey, song)
    if (musicPlayer.value.song !== song) {
      musicPlayer.value.song = song
    }
  }
  reader.readAsArrayBuffer(selectedSongFile!)
}

musicOptions.addEventListener("change", setSelectedSong)
musicControls.addEventListener("submit", e => {
  e.preventDefault()
  //await setSelectedSong()
  if (e.submitter === musicStop) {
    musicPlayer.value.pause()
    musicPlayer.value.position = 0
  } else {
    musicPlayer.value.state === "paused" ? musicPlayer.value.play() : musicPlayer.value.pause()
  }
})

// Insert SFX and music controls.

const soundTestContainer = document.getElementById("sound-test") as HTMLElement
for (const childNode of soundTestContainer.childNodes) {
  childNode.remove()
}
//soundTestContainer.append(sfxControls)
soundTestContainer.append(musicControls)
