// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:life360_mobile/main.dart';

void main() {
  testWidgets('Life360 smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const Life360App(
      currentUserId: 'test-user',
      currentUserName: 'Tester',
      backendWsUrl: 'ws://127.0.0.1:4000',
    ));
    expect(find.byType(Life360App), findsOneWidget);
  });
}
