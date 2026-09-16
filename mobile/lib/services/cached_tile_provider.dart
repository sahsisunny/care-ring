import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:http/retry.dart';
import 'package:latlong2/latlong.dart' hide Circle;
import 'package:path_provider/path_provider.dart';

/// Production multi-tier Tile Cache Provider (modeled after Google & Apple Maps).
/// 
/// 1. L1 Memory Cache: Zero-latency instantaneous tile access via Flutter ImageCache.
/// 2. L2 Persistent Disk Cache: Automatically stores tile PNG bytes locally on flash storage.
/// 3. L3 Network Fallback: Intelligently fetches from tile server and asynchronously caches.
/// 4. Offline Map Support: Previously viewed or pre-cached regions render completely offline.
class CachedTileProvider extends TileProvider {
  static Directory? _cacheDirectory;
  static bool _isInitialized = false;

  final http.BaseClient _httpClient;
  final bool silenceExceptions;
  final _tilesInProgress = HashMap<TileCoordinates, Completer<void>>();

  CachedTileProvider({
    super.headers,
    http.BaseClient? httpClient,
    this.silenceExceptions = true,
  }) : _httpClient = httpClient ?? RetryClient(http.Client());

  /// Initializes the local disk storage cache directory
  static Future<void> initialize() async {
    if (_isInitialized) return;
    try {
      final baseDir = await getApplicationSupportDirectory();
      _cacheDirectory = Directory('${baseDir.path}/map_tiles_cache');
      if (!await _cacheDirectory!.exists()) {
        await _cacheDirectory!.create(recursive: true);
      }
      _isInitialized = true;
    } catch (e) {
      // Fallback to temp directory if application support is unavailable
      final tempDir = await getTemporaryDirectory();
      _cacheDirectory = Directory('${tempDir.path}/map_tiles_cache');
      if (!await _cacheDirectory!.exists()) {
        await _cacheDirectory!.create(recursive: true);
      }
      _isInitialized = true;
    }
  }

  /// Calculates cache statistics (total files and formatted megabytes)
  static Future<Map<String, dynamic>> getCacheStats() async {
    if (_cacheDirectory == null || !await _cacheDirectory!.exists()) {
      return {'count': 0, 'sizeBytes': 0, 'formattedSize': '0 KB'};
    }

    int totalBytes = 0;
    int tileCount = 0;

    try {
      final files = _cacheDirectory!.listSync(recursive: true, followLinks: false);
      for (final entity in files) {
        if (entity is File) {
          totalBytes += await entity.length();
          tileCount++;
        }
      }
    } catch (_) {}

    String formatted;
    if (totalBytes < 1024) {
      formatted = '$totalBytes B';
    } else if (totalBytes < 1024 * 1024) {
      formatted = '${(totalBytes / 1024).toStringAsFixed(1)} KB';
    } else {
      formatted = '${(totalBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }

    return {
      'count': tileCount,
      'sizeBytes': totalBytes,
      'formattedSize': formatted,
    };
  }

  /// Clears all stored disk cache files
  static Future<void> clearCache() async {
    if (_cacheDirectory != null && await _cacheDirectory!.exists()) {
      try {
        await _cacheDirectory!.delete(recursive: true);
        await _cacheDirectory!.create(recursive: true);
        PaintingBinding.instance.imageCache.clear();
        PaintingBinding.instance.imageCache.clearLiveImages();
      } catch (_) {}
    }
  }

  /// Pre-caches an offline map region around a center coordinate (e.g. city / circle)
  static Future<int> precacheArea({
    required LatLng center,
    required String urlTemplate,
    int minZoom = 13,
    int maxZoom = 15,
    double radiusKm = 2.5,
    Function(int current, int total)? onProgress,
  }) async {
    await initialize();
    if (_cacheDirectory == null) return 0;

    final client = http.Client();
    final List<TileCoordinates> tilesToFetch = [];

    for (int z = minZoom; z <= maxZoom; z++) {
      final double latDelta = radiusKm / 110.574;
      final double lngDelta = radiusKm / (111.320 * math.cos(center.latitude * math.pi / 180.0));

      final minLat = center.latitude - latDelta;
      final maxLat = center.latitude + latDelta;
      final minLng = center.longitude - lngDelta;
      final maxLng = center.longitude + lngDelta;

      final p1 = _latLngToTile(maxLat, minLng, z);
      final p2 = _latLngToTile(minLat, maxLng, z);

      for (int x = math.min(p1.x, p2.x); x <= math.max(p1.x, p2.x); x++) {
        for (int y = math.min(p1.y, p2.y); y <= math.max(p1.y, p2.y); y++) {
          tilesToFetch.add(TileCoordinates(x, y, z));
        }
      }
    }

    int cachedCount = 0;
    for (int i = 0; i < tilesToFetch.length; i++) {
      final t = tilesToFetch[i];
      final tileFile = File('${_cacheDirectory!.path}/${t.z}_${t.x}_${t.y}.png');

      if (!tileFile.existsSync()) {
        try {
          final url = urlTemplate
              .replaceAll('{z}', t.z.toString())
              .replaceAll('{x}', t.x.toString())
              .replaceAll('{y}', t.y.toString());

          final response = await client.get(
            Uri.parse(url),
            headers: {'User-Agent': 'com.life360.familylocation.life360_mobile'},
          ).timeout(const Duration(seconds: 5));

          if (response.statusCode == 200 && response.bodyBytes.isNotEmpty) {
            await tileFile.parent.create(recursive: true);
            await tileFile.writeAsBytes(response.bodyBytes);
            cachedCount++;
          }
        } catch (_) {}
      } else {
        cachedCount++;
      }

      onProgress?.call(i + 1, tilesToFetch.length);
    }

    client.close();
    return cachedCount;
  }

  static math.Point<int> _latLngToTile(double lat, double lng, int zoom) {
    final n = math.pow(2.0, zoom);
    final x = ((lng + 180.0) / 360.0 * n).floor();
    final latRad = lat * math.pi / 180.0;
    final y = ((1.0 - math.log(math.tan(latRad) + 1.0 / math.cos(latRad)) / math.pi) / 2.0 * n).floor();
    return math.Point<int>(x, y);
  }

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    final url = getTileUrl(coordinates, options);
    final fallbackUrl = getTileFallbackUrl(coordinates, options);
    final cacheDir = _cacheDirectory?.path ?? '';
    final localFile = File('$cacheDir/${coordinates.z}_${coordinates.x}_${coordinates.y}.png');

    return CachedTileImageProvider(
      url: url,
      fallbackUrl: fallbackUrl,
      localFile: localFile,
      headers: headers,
      httpClient: _httpClient,
      silenceExceptions: silenceExceptions,
      startedLoading: () => _tilesInProgress[coordinates] = Completer(),
      finishedLoadingBytes: () {
        _tilesInProgress[coordinates]?.complete();
        _tilesInProgress.remove(coordinates);
      },
    );
  }

  @override
  Future<void> dispose() async {
    if (_tilesInProgress.isNotEmpty) {
      await Future.wait(_tilesInProgress.values.map((c) => c.future));
    }
    _httpClient.close();
    super.dispose();
  }
}

/// Custom ImageProvider that serves tiles from disk cache if present,
/// or downloads via HTTP and persists asynchronously to disk.
@immutable
class CachedTileImageProvider extends ImageProvider<CachedTileImageProvider> {
  final String url;
  final String? fallbackUrl;
  final File localFile;
  final Map<String, String> headers;
  final http.BaseClient httpClient;
  final bool silenceExceptions;
  final VoidCallback startedLoading;
  final VoidCallback finishedLoadingBytes;

  const CachedTileImageProvider({
    required this.url,
    required this.fallbackUrl,
    required this.localFile,
    required this.headers,
    required this.httpClient,
    required this.silenceExceptions,
    required this.startedLoading,
    required this.finishedLoadingBytes,
  });

  @override
  ImageStreamCompleter loadImage(
    CachedTileImageProvider key,
    ImageDecoderCallback decode,
  ) =>
      MultiFrameImageStreamCompleter(
        codec: _load(key, decode),
        scale: 1,
        debugLabel: url,
      );

  Future<Codec> _load(
    CachedTileImageProvider key,
    ImageDecoderCallback decode, {
    bool useFallback = false,
  }) async {
    // 1. FAST L2 DISK CACHE HIT (Zero network dependency, works offline)
    try {
      if (localFile.existsSync()) {
        final bytes = await localFile.readAsBytes();
        if (bytes.isNotEmpty) {
          final buffer = await ImmutableBuffer.fromUint8List(bytes);
          return await decode(buffer);
        }
      }
    } catch (_) {}

    // 2. L3 NETWORK FETCH & BACKGROUND PERSISTENCE
    startedLoading();

    try {
      final requestUrl = useFallback ? (fallbackUrl ?? url) : url;
      final uri = Uri.parse(requestUrl);
      final bytes = await httpClient.readBytes(uri, headers: headers);
      finishedLoadingBytes();

      // Write asynchronously to disk cache in background
      _persistAsync(bytes);

      final buffer = await ImmutableBuffer.fromUint8List(bytes);
      return await decode(buffer);
    } catch (err) {
      finishedLoadingBytes();
      scheduleMicrotask(() => PaintingBinding.instance.imageCache.evict(key));

      if (!useFallback && fallbackUrl != null) {
        return _load(key, decode, useFallback: true);
      }

      if (silenceExceptions) {
        // Return transparent tile gracefully if network is unavailable offline
        final buffer = await ImmutableBuffer.fromUint8List(TileProvider.transparentImage);
        return await decode(buffer);
      }
      rethrow;
    }
  }

  void _persistAsync(Uint8List bytes) async {
    try {
      if (!await localFile.parent.exists()) {
        await localFile.parent.create(recursive: true);
      }
      await localFile.writeAsBytes(bytes);
    } catch (_) {}
  }

  @override
  SynchronousFuture<CachedTileImageProvider> obtainKey(
    ImageConfiguration configuration,
  ) =>
      SynchronousFuture(this);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedTileImageProvider &&
          fallbackUrl == null &&
          url == other.url);

  @override
  int get hashCode =>
      Object.hashAll([url, if (fallbackUrl != null) fallbackUrl]);
}
