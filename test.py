from flask import Flask, request
app = Flask(__name__)


@app.route('/apiv2/bind-qq', methods=['POST'])
def bind():
    print(request.get_data(as_text=True))
    return {
        "code": 0,
        "name": '郭襄'
    }


app.run(debug=True, host='localhost', port=3001)
