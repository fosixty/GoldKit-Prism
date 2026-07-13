/*
 * ptx-json — JSON wrapper around ptformat for GoldKit Prism
 * SPDX-License-Identifier: MIT (wrapper); ptformat is LGPL-2.1+
 */

#include "ptformat/ptformat.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <map>
#include <string>
#include <vector>

static void json_escape(FILE* out, const std::string& s) {
  fputc('"', out);
  for (unsigned char c : s) {
    switch (c) {
      case '"': fputs("\\\"", out); break;
      case '\\': fputs("\\\\", out); break;
      case '\b': fputs("\\b", out); break;
      case '\f': fputs("\\f", out); break;
      case '\n': fputs("\\n", out); break;
      case '\r': fputs("\\r", out); break;
      case '\t': fputs("\\t", out); break;
      default:
        if (c < 0x20) fprintf(out, "\\u%04x", c);
        else fputc(c, out);
    }
  }
  fputc('"', out);
}

static std::string basename_from_path(const std::string& path) {
  size_t pos = path.find_last_of("/\\");
  if (pos == std::string::npos) return path;
  return path.substr(pos + 1);
}

static std::string session_name_from_path(const std::string& path) {
  std::string base = basename_from_path(path);
  size_t dot = base.rfind('.');
  if (dot != std::string::npos) base = base.substr(0, dot);
  return base;
}

struct RegionJson {
  std::string sourceFile;
  int64_t startSamples;
  int64_t lengthSamples;
  int64_t offsetSamples;
};

struct TrackJson {
  std::string name;
  std::string type;
  int channels;
  std::vector<RegionJson> regions;
};

int main(int argc, char** argv) {
  if (argc < 2) {
    fprintf(stderr, "Usage: ptx-json <session.ptx> [--session-dir <dir>]\n");
    return 1;
  }

  const char* ptx_path = argv[1];
  std::string session_dir;
  for (int i = 2; i < argc; ++i) {
    if (strcmp(argv[i], "--session-dir") == 0 && i + 1 < argc) {
      session_dir = argv[++i];
    }
  }

  PTFFormat ptf;
  int ok = ptf.load(ptx_path, 48000);

  if (ok != 0) {
  fprintf(stdout,
      "{\"error\":\"Failed to load session (code %d). Unsupported or corrupt .ptx file.\"}\n",
      ok);
    return 1;
  }

  std::map<std::string, TrackJson> audio_tracks;
  std::map<std::string, TrackJson> midi_tracks;

  for (const auto& track : ptf.tracks()) {
    TrackJson& t = audio_tracks[track.name];
    t.name = track.name;
    t.type = "audio";
    t.channels = 2;

    RegionJson region;
    region.sourceFile = track.reg.wave.filename;
    region.startSamples = track.reg.startpos;
    region.lengthSamples = track.reg.length;
    region.offsetSamples = track.reg.sampleoffset;
    t.regions.push_back(region);
  }

  for (const auto& track : ptf.miditracks()) {
    TrackJson& t = midi_tracks[track.name];
    t.name = track.name;
    t.type = "midi";
    t.channels = 0;
    RegionJson region;
    region.sourceFile = "";
    region.startSamples = track.reg.startpos;
    region.lengthSamples = track.reg.length;
    region.offsetSamples = track.reg.sampleoffset;
    t.regions.push_back(region);
  }

  FILE* out = stdout;
  fprintf(out, "{");
  fprintf(out, "\"sessionName\":");
  json_escape(out, session_name_from_path(ptx_path));
  fprintf(out, ",\"sampleRate\":%lld,\"bitDepth\":24,\"tracks\":[", (long long)ptf.sessionrate());

  bool first_track = true;
  auto emit_track = [&](const TrackJson& track) {
    if (!first_track) fprintf(out, ",");
    first_track = false;
    fprintf(out, "{");
    fprintf(out, "\"name\":");
    json_escape(out, track.name);
    fprintf(out, ",\"type\":");
    json_escape(out, track.type);
    fprintf(out, ",\"channels\":%d,\"regions\":[", track.channels);

    for (size_t i = 0; i < track.regions.size(); ++i) {
      const RegionJson& r = track.regions[i];
      if (i > 0) fprintf(out, ",");
      fprintf(out, "{");
      fprintf(out, "\"sourceFile\":");
      json_escape(out, r.sourceFile);
      fprintf(out, ",\"startSamples\":%lld,\"lengthSamples\":%lld,\"offsetSamples\":%lld",
        (long long)r.startSamples, (long long)r.lengthSamples, (long long)r.offsetSamples);
      fprintf(out, "}");
    }
    fprintf(out, "]}");
  };

  for (const auto& pair : audio_tracks) emit_track(pair.second);
  for (const auto& pair : midi_tracks) emit_track(pair.second);

  fprintf(out, "]}\n");
  return 0;
}
