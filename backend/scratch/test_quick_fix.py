import urllib.request
import json
import os

req = urllib.request.Request(
    'http://localhost:8000/api/v1/quick-fix',
    data=json.dumps({
        'language': 'java',
        'code': 'import java.sql.*;\npublic class Test {\n    String username = "admin";\n    String password = "supersecret";\n    public void getUser(String userInput) throws Exception {\n        Connection conn = DriverManager.getConnection("jdbc:mysql://localhost:3306/db", "root", "root");\n        Statement stmt = conn.createStatement();\n        ResultSet rs = stmt.executeQuery("SELECT * FROM users WHERE name = \'" + userInput + "\'");\n    }\n}',
        'issue': {
            'id': 1,
            'title': 'SQL Injection',
            'severity': 'critical',
            'line': 9,
            'description': 'SQL injection vulnerability'
        }
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    with urllib.request.urlopen(req) as f:
        print(f.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read().decode('utf-8'))
except Exception as e:
    print(e)
