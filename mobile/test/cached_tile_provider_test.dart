import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:life360_mobile/services/cached_tile_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('CachedTileProvider Tests', () {
    test('CachedTileProvider can be instantiated with default client', () {
      final provider = CachedTileProvider();
      expect(provider, isNotNull);
      expect(provider.silenceExceptions, isTrue);
    });

    test('getCacheStats returns valid map with default zero or existing counts', () async {
      final stats = await CachedTileProvider.getCacheStats();
      expect(stats, contains('count'));
      expect(stats, contains('sizeBytes'));
      expect(stats, contains('formattedSize'));
      expect(stats['count'], isA<int>());
      expect(stats['sizeBytes'], isA<int>());
      expect(stats['formattedSize'], isA<String>());
    });
    test('TileLayer accepts transformer and subdomains', () {
      final layer = TileLayer(
        urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        subdomains: const ['a', 'b', 'c', 'd'],
        tileUpdateTransformer: TileUpdateTransformers.throttle(const Duration(milliseconds: 100)),
        panBuffer: 0,
      );
      expect(layer, isNotNull);
    });
  });
}
