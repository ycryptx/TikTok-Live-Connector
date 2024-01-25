const Config = require('./webcastConfig.js');
const { deserializeWebsocketMessage, serializeMessage } = require('./webcastProtobuf.js');

class WebcastWebsocket extends WebSocket {
    constructor(wsUrl, cookieJar, clientParams, wsParams, customHeaders, websocketOptions) {
        super(wsUrl);
        this.pingInterval = null;
        this.connection = null;
        this.wsParams = { ...clientParams, ...wsParams };
        this.wsUrlWithParams = `${wsUrl}?${new URLSearchParams(this.wsParams)}`;
        this.wsHeaders = {
            Cookie: cookieJar.getCookieString(),
            ...(customHeaders || {}),
        };

        this.addEventListener('open', (event) => {
            this.connection = event.target;
            this.pingInterval = setInterval(() => this.sendPing(), 10000);
        });

        this.addEventListener('message', (event) => {
            if (event.data instanceof Blob) {
                this.handleMessage(event.data);
            }
        });

        this.addEventListener('close', () => {
            clearInterval(this.pingInterval);
        });
    }

    async handleMessage(message) {
        try {
            let decodedContainer = await deserializeWebsocketMessage(await message.arrayBuffer());

            if (decodedContainer.id > 0) {
                this.sendAck(decodedContainer.id);
            }

            // Emit 'WebcastResponse' from ws message container if decoding success
            if (typeof decodedContainer.webcastResponse === 'object') {
                this.emit('webcastResponse', decodedContainer.webcastResponse);
            }
        } catch (err) {
            this.emit('messageDecodingFailed', err);
        }
    }

    sendPing() {
        // Send static connection alive ping
        this.connection.send(Buffer.from('3A026862', 'hex'));
    }

    sendAck(id) {
        let ackMsg = serializeMessage('WebcastWebsocketAck', { type: 'ack', id });
        this.connection.send(ackMsg);
    }
}

module.exports = WebcastWebsocket;