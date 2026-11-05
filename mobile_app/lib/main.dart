import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:file_selector_platform_interface/file_selector_platform_interface.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:http/http.dart' as http;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Color(0xFF0F4C81),
      statusBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const LocalAssessmentApp());
}

class LocalAssessmentApp extends StatelessWidget {
  const LocalAssessmentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'التقييم التربوي للطفولة المبكرة',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F4C81),
          primary: const Color(0xFF0F4C81),
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        );
      },
      home: const LocalWebViewScreen(),
    );
  }
}

class LocalWebViewScreen extends StatefulWidget {
  const LocalWebViewScreen({super.key});

  @override
  State<LocalWebViewScreen> createState() => _LocalWebViewScreenState();
}

class _LocalWebViewScreenState extends State<LocalWebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;
  double _progress = 0;
  String? _errorMessage;

  // Default candidates for local network server
  String _currentUrl = 'http://192.168.1.58:3000';
  bool _canGoBack = false;
  bool _canGoForward = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  Future<void> _initWebView() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('local_server_url');
    if (saved != null && saved.trim().isNotEmpty) {
      _currentUrl = saved.trim();
    }

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF8FAFC))
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: (JavaScriptMessage msg) {
          _handleBridgeMessage(msg.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) {
              setState(() {
                _progress = progress / 100.0;
              });
            }
          },
          onPageStarted: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _errorMessage = null;
              });
            }
          },
          onPageFinished: (String url) async {
            final canBack = await _controller.canGoBack();
            final canFwd = await _controller.canGoForward();
            if (mounted) {
              setState(() {
                _isLoading = false;
                _canGoBack = canBack;
                _canGoForward = canFwd;
              });
            }
          },
          onWebResourceError: (WebResourceError error) {
            if (error.isForMainFrame ?? true) {
              if (mounted) {
                setState(() {
                  _isLoading = false;
                  _errorMessage =
                      'تعذر الاتصال بالخادم (${error.description}).\nتأكد من تشغيل المشروع أو صحة الرابط.';
                });
              }
            }
          },
        ),
      );

    if (_controller.platform is AndroidWebViewController) {
      final androidController = _controller.platform as AndroidWebViewController;
      await androidController.setOnShowFileSelector((FileSelectorParams params) async {
        try {
          final List<XFile> files;
          if (params.mode == FileSelectorMode.openMultiple) {
            files = await FileSelectorPlatform.instance.openFiles();
          } else {
            final file = await FileSelectorPlatform.instance.openFile();
            files = file != null ? [file] : [];
          }
          return files.map((f) => Uri.file(f.path).toString()).toList();
        } catch (e) {
          debugPrint('File picker error: $e');
          return [];
        }
      });
    }

    _loadUrl(_currentUrl);
  }

  Future<void> _handleBridgeMessage(String jsonStr) async {
    try {
      final Map<String, dynamic> data = jsonDecode(jsonStr);
      final String action = data['action'] ?? '';
      final String filename = data['filename'] ?? 'report.pdf';
      final String base64Data = data['base64'] ?? '';
      final Uint8List bytes = base64Decode(base64Data);

      if (action == 'download') {
        await _handleDownload(filename, bytes);
      } else if (action == 'share') {
        await _handleShare(filename, bytes);
      } else if (action == 'print' || action == 'preview') {
        await _handlePrintOrPreview(filename, bytes);
      }
    } catch (e) {
      debugPrint('Bridge message error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('حدث خطأ في معالجة الملف: $e',
                style: const TextStyle(fontFamily: 'Roboto')),
            backgroundColor: Colors.red.shade800,
          ),
        );
      }
    }
  }

  Future<void> _handleDownload(String filename, Uint8List bytes) async {
    try {
      Directory? dir;
      if (Platform.isAndroid) {
        dir = Directory('/storage/emulated/0/Download');
        if (!dir.existsSync()) {
          dir = await getExternalStorageDirectory();
        }
      } else {
        dir = await getApplicationDocumentsDirectory();
      }
      final file = File('${dir!.path}/$filename');
      await file.writeAsBytes(bytes);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تم حفظ الملف بنجاح:\n$filename'),
            backgroundColor: const Color(0xFF16A34A),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'مشاركة / فتح',
              textColor: Colors.white,
              onPressed: () {
                Share.shareXFiles([XFile(file.path)], text: filename);
              },
            ),
          ),
        );
      }
    } catch (e) {
      final tempDir = await getTemporaryDirectory();
      final file = File('${tempDir.path}/$filename');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)], text: filename);
    }
  }

  Future<void> _handleShare(String filename, Uint8List bytes) async {
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/$filename');
    await file.writeAsBytes(bytes);
    await Share.shareXFiles([XFile(file.path)], text: filename);
  }

  Future<void> _handlePrintOrPreview(String filename, Uint8List bytes) async {
    if (filename.toLowerCase().endsWith('.pdf')) {
      await Printing.layoutPdf(
        name: filename,
        onLayout: (format) async => bytes,
      );
    } else {
      await _handleDownload(filename, bytes);
    }
  }

  void _loadUrl(String url) {
    String formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'http://$formatted';
    }
    setState(() {
      _currentUrl = formatted;
      _isLoading = true;
      _errorMessage = null;
    });
    _controller.loadRequest(Uri.parse(formatted));
  }

  Future<void> _showServerConfigDialog() async {
    final controller = TextEditingController(text: _currentUrl);
    bool testing = false;
    String? testStatus;
    bool testOk = false;

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.settings_ethernet_rounded, color: Color(0xFF0F4C81)),
              SizedBox(width: 8),
              Text(
                'إعدادات الاتصال (سحابي / محلي)',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'أدخل رابط موقعك على Vercel للاتصال بالإنترنت، أو عنوان IP الحاسوب للاتصال المحلي بدون إنترنت:',
                  style: TextStyle(fontSize: 12, color: Colors.black87),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  textDirection: TextDirection.ltr,
                  decoration: const InputDecoration(
                    labelText: 'عنوان الخادم أو الرابط',
                    hintText: 'https://....vercel.app أو http://192.168.1.58:3000',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.link_rounded),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'خيارات سريعة مقترحة:',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _presetChip('http://192.168.1.58:3000', 'شبكة Wi-Fi المحلية',
                        controller, setDlgState),
                    _presetChip('http://10.0.2.2:3000', 'المحاكي (Emulator)',
                        controller, setDlgState),
                    _presetChip('http://localhost:3000', 'محلي (Localhost)',
                        controller, setDlgState),
                  ],
                ),
                if (testStatus != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: testOk
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      testStatus!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: testOk
                            ? const Color(0xFF166534)
                            : Colors.red.shade900,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: testing
                  ? null
                  : () async {
                      setDlgState(() {
                        testing = true;
                        testStatus = 'جارٍ فحص استجابة الخادم...';
                      });
                      try {
                        String url = controller.text.trim();
                        if (!url.startsWith('http')) url = 'http://$url';
                        final res = await http
                            .get(Uri.parse(url))
                            .timeout(const Duration(seconds: 4));
                        setDlgState(() {
                          testing = false;
                          testOk = res.statusCode >= 200 && res.statusCode < 400;
                          testStatus = testOk
                              ? '✓ الاتصال ناجح بالخادم المحلي!'
                              : 'استجاب الخادم برمز: ${res.statusCode}';
                        });
                      } catch (e) {
                        setDlgState(() {
                          testing = false;
                          testOk = false;
                          testStatus = 'تعذر الوصول للخادم: $e';
                        });
                      }
                    },
              child: const Text('فحص الاتصال ⚡'),
            ),
            ElevatedButton(
              onPressed: () async {
                final url = controller.text.trim();
                if (url.isNotEmpty) {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setString('local_server_url', url);
                  if (ctx.mounted) {
                    Navigator.pop(ctx);
                  }
                  _loadUrl(url);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F4C81),
                foregroundColor: Colors.white,
              ),
              child: const Text('حفظ وفتح'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _presetChip(String url, String label, TextEditingController ctrl,
      StateSetter setDlgState) {
    return InkWell(
      onTap: () {
        setDlgState(() {
          ctrl.text = url;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 10, color: Color(0xFF0F4C81)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_canGoBack,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _canGoBack) {
          await _controller.goBack();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'التقييم التربوي للطفولة المبكرة',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              Text(
                _currentUrl,
                style: TextStyle(
                    fontSize: 10, color: Colors.white.withOpacity(0.8)),
                textDirection: TextDirection.ltr,
              ),
            ],
          ),
          backgroundColor: const Color(0xFF0F4C81),
          foregroundColor: Colors.white,
          elevation: 2,
          actions: [
            IconButton(
              icon: const Icon(Icons.arrow_forward_ios_rounded, size: 18),
              tooltip: 'للخلف',
              onPressed: _canGoBack ? () => _controller.goBack() : null,
            ),
            IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, size: 18),
              tooltip: 'للأمام',
              onPressed: _canGoForward ? () => _controller.goForward() : null,
            ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'تحديث الصفحة',
              onPressed: () => _controller.reload(),
            ),
            IconButton(
              icon: const Icon(Icons.settings_ethernet_rounded),
              tooltip: 'إعدادات عنوان الخادم المحلي',
              onPressed: _showServerConfigDialog,
            ),
          ],
          bottom: _isLoading
              ? PreferredSize(
                  preferredSize: const Size.fromHeight(3),
                  child: LinearProgressIndicator(
                    value: _progress > 0 ? _progress : null,
                    backgroundColor: Colors.transparent,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                        Color(0xFF4ADE80)),
                  ),
                )
              : null,
        ),
        body: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_errorMessage != null)
              Container(
                color: const Color(0xFFF8FAFC),
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.wifi_off_rounded,
                            size: 54, color: Colors.red),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'تعذر الاتصال بالخادم المحلي',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 13, color: Colors.grey.shade700),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _currentUrl,
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'monospace'),
                          textDirection: TextDirection.ltr,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ElevatedButton.icon(
                            onPressed: () => _loadUrl(_currentUrl),
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('إعادة المحاولة'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0F4C81),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                            ),
                          ),
                          const SizedBox(width: 10),
                          OutlinedButton.icon(
                            onPressed: _showServerConfigDialog,
                            icon: const Icon(Icons.edit_rounded),
                            label: const Text('تغيير عنوان الخادم'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
