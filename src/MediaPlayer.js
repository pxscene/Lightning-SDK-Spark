import { MediaPlayer as WPEMediaPlayer, Log, Metrics, Lightning } from 'lightning-sdk'

const PlayerState = {
  IDLE: 0,
  INITIALIZING: 1,
  INITIALIZED: 2,
  PREPARING: 3,
  PREPARED: 4,
  BUFFERING: 5,
  PAUSED: 6,
  SEEKING: 7,
  PLAYING: 8,
  STOPPING: 9,
  STOPPED: 10,
  COMPLETE: 11,
  ERROR: 12,
  RELEASED: 13
};

export default class MediaPlayer extends WPEMediaPlayer {
  static _supportedEvents() {
    return ['onProgressUpdate', 'onPlaybackStarted', 'onEndOfStream', 'onPlayerStateChanged'];
  }

  set textureMode(v) {
    return this._textureMode = v;
  }

  _init() {
    let proxyServer = "";
    if (sparkQueryParams && sparkQueryParams.sparkVideoProxyServer) {
      proxyServer = sparkQueryParams.sparkVideoProxyServer;
    }

    this.videoEl = sparkscene.create({
      t: "video",
      id: "video-player",
      proxy:proxyServer
    });
    this.videoEl.style = {}

    var _this = this;
    sparkscene.on('onClose' , function(e) {
      _this.close();
    });

    this.eventHandlers = [];
  }

  _registerListeners() {
    MediaPlayer._supportedEvents().forEach(event => {
      const handler = e => {
        if (this._metrics[event] && typeof this._metrics[event] === 'function') {
          this._metrics[event]({ currentTime: this.videoEl.currentTime })
        }
        this.fire(event, { videoElement: this.videoEl, event: e })
      }
      this.eventHandlers.push(handler)
      this.videoEl.on(event, handler)
    })
  }

  _deregisterListeners() {
    Log.info('Deregistering event listeners MediaPlayer')
    MediaPlayer._supportedEvents().forEach((event, index) => {
      this.videoEl.delListener(event, this.eventHandlers[index])
    })
    this.eventHandlers = []
  }

  updateSettings(settings = {}) {
    return super.updateSettings(settings)
  }

  _setHide(hide) {
    this.videoEl.a = hide ? 0 : 1;
  }

  open(url, settings = { hide: false, videoPosition: null }) {
    this._metrics = Metrics.media(url)
    Log.info('Playing stream', url)
    if (this.application.noVideo) {
      Log.info('noVideo option set, so ignoring: ' + url)
      return
    }
    var videoUrl = url;                                                                                                     
    var optionIndex = url.indexOf("?");                                                   
    // encode any url params                                                                                                
    if (optionIndex != -1) {                                                              
      var options = url.substring(optionIndex+1);                                  
      videoUrl = url.substring(0, optionIndex) + '?' + encodeURIComponent(options);
    }                                                                             
    if (this.videoEl.url === videoUrl) return this.reload();                       
                                                                                                                          
    this.videoEl.url = videoUrl;  
    
    this._setHide(settings.hide)
    this._setVideoArea(settings.videoPosition || [0, 0, 1920, 1080])

    this.canplay()
  }

  close() {
    this.videoEl.stop();
    this._clearSrc();
  }

  doPlay() {
    this.videoEl.speed = 1
  }

  doPause() {
    return super.doPause()
  }

  reload() {
    var url = this.videoEl.url;
    this.close();
    this.videoEl.url = url;
    this.canplay();
  }

  getPosition() {
    return Promise.resolve(this.videoEl.position);
  }

  setPosition(pos) {
    this.videoEl.position = pos;
  }

  getDuration() {
    return super.getDuration()
  }

  seek(time, absolute = false) {
    if(absolute) {
      this.videoEl.position = time;
    }
    else {
      this.videoEl.setPositionRelative(time);
    }
  }

  _setVideoArea(videoPos) {
    if (Lightning.Utils.equalValues(this._videoPos, videoPos)) {
      return
    }

    this._videoPos = videoPos;

    if (this.textureMode) {
      this.videoTextureView.patch({
        smooth: {
          x: videoPos[0],
          y: videoPos[1],
          w: videoPos[2] - videoPos[0],
          h: videoPos[3] - videoPos[1]
        }
      });
    } else {
      const precision = this.stage.getRenderPrecision();
      this.videoEl.x = Math.round(videoPos[0] * precision) + 'px';
      this.videoEl.y = Math.round(videoPos[1] * precision) + 'px';
      this.videoEl.w = Math.round((videoPos[2] - videoPos[0]) * precision) + 'px';
      this.videoEl.h = Math.round((videoPos[3] - videoPos[1]) * precision) + 'px';
    }
  }

  seeked() {
    this._fireConsumer('$mediaplayerSeeked', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
  }

  seeking() {
    this._fireConsumer('$mediaplayerSeeking', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
  }

  onEndOfStream(args) {
    this.ended(args);
  }

  onProgressUpdate(args) {
    this._fireConsumer('$mediaplayerProgress', {
      currentTime: this.videoEl.position,
      duration: this.videoEl.duration || 1
    });
  }

  onPlaybackStarted(args) {                                                                                                 
    this.playing();                                        
    this.play();                                              
  }   
  
  onPlayerStateChanged(args) {
    let prevState = this.playerState;
    this.playerState = args.event.state;

    switch (this.playerState) {
      case PlayerState.IDLE: break;
      case PlayerState.INITIALIZING:
        this.loadstart();
        break;
      case PlayerState.INITIALIZED: break;
      case PlayerState.PREPARING: break;
      case PlayerState.PREPARED:
        this.loadeddata();
        break;
      case PlayerState.BUFFERING: break;
      case PlayerState.PAUSED:
        this.pause();
        break;
      case PlayerState.SEEKING:
        this.seeking();
        break;
      case PlayerState.PLAYING:
        if (prevState === PlayerState.PAUSED)
          this.play();
        else {
          if (prevState === PlayerState.SEEKING)
            this.seeked();
          this.playing();
        }
        break;
      case PlayerState.STOPPING: break;
      case PlayerState.STOPPED:
        this._clearSrc();
        break;
      case PlayerState.COMPLETE:
        this.ended();
        break;
      case PlayerState.ERROR:
        this.error();
        break;
      case PlayerState.RELEASED: break;
    }
  }
  
  _startUpdatingVideoTexture() {                                                                                            
  }                                                                  
                                                                   
  _stopUpdatingVideoTexture() {                               
  }   
}
