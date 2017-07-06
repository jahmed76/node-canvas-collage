"use strict";

const Promise  = require("bluebird");
const request  = require("request");
const Canvas   = require("canvas");
const fs       = Promise.promisifyAll(require("fs"));
const Image = Canvas.Image;

function downloadPhoto (uri) {
  return new Promise((resolve, reject) => {
    let data;

    const stream = request(uri);
    stream.on("data", (chunk) => data = data ? Buffer.concat([data, chunk]) : chunk);
    stream.on("error", reject);
    stream.on("end", () => resolve(data));
  });
}

function getPhoto (src) {
  if (src instanceof Buffer) {
    return src;
  } else if (typeof src === "string") {
    if (/^http/.test(src) || /^ftp/.test(src)) {
      return downloadPhoto(src)
        .catch(() => {throw new Error(`Could not download url source: ${src}`);});
    } else {
      return fs.readFileAsync(src)
        .catch(() => {throw new Error(`Could not load file source: ${src}`);});
    }
  } else if (src instanceof Canvas) {
    return src.toBuffer();
  } else {
    throw new Error(`Unsupported source type: ${src}`);
  }
}

const PARAMS = [
  {field: "sources", required: true},
  {field: "width", required: true},
  {field: "height", required: true},
  {field: "imageWidth", required: true},
  {field: "imageHeight", required: true},
  {field: "spacing", default: 0},
  {field: "backgroundColor", default: "#000000"},
];

module.exports = {
  createCollage: function(options){
    if (Array.isArray(options)) {
      options = {sources: options};
    }

    PARAMS.forEach((param) => {
      if (options[param.field]) {
        return;      
      } else if (param.default != null) {
        options[param.field] = param.default;
      } else if (param.required) {
        throw new Error(`Missing required option: ${param.field}`);
      }
    });

    const canvasWidth = options.canvasWidth || (options.width * options.imageWidth + (options.width - 1) * (options.spacing));
    const canvasHeight = options.canvasHeight || (options.height * options.imageHeight + (options.height - 1) * (options.spacing));
    const canvas = new Canvas(canvasWidth, canvasHeight);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    var overlay = new Image;
    if(options.overlay){
      overlay.src = options.overlay;
    }

    return Promise
      .map(options.sources, getPhoto)
      .each((photoBuffer, i) => {
        if (i >= options.width * options.height) return;
        var row = (i % options.width) + 1;
        var x = (i % options.width) * (options.imageWidth) + row * options.spacing + options.outerspacing.left;
        var y = Math.floor(i / options.width) * (options.imageHeight) + options.outerspacing.top;
      
        const img = new Canvas.Image();
        img.src = photoBuffer;

        ctx.drawImage(img, x, y, options.imageWidth, options.imageHeight);
        if(options.overlay){
          ctx.drawImage(overlay, 0, 0, options.overlayWidth, options.overlayHeight);
        }
      })
      .return(canvas);
  },
  generateImageFromText: function(options){
    var canvas = new Canvas(options.canvasWidth, options.canvasHeight),
      ctx = canvas.getContext('2d');

    ctx.font = "normal 40px Arial, serif"//(options.fontSize || '36') + 'px "Impact"';
    ctx.fillStyle = options.backgroundColor || '#000000';
    ctx.fillRect(0, 0, options.canvasWidth, options.canvasHeight);

    return Promise
      .map(options.textStrings, res => res)
      .each((text, i) => {
        ctx.fillStyle = '#000'
        ctx.fillText(text, 150, (i * 75) + 150);

      })
      .return(canvas);
  },
  addOverlay: function(options){
    var canvas = new Canvas(options.canvasWidth, options.canvasHeight),
       ctx = canvas.getContext('2d');

    var overlay = new Image;
    overlay.src = options.overlay;
    
    return Promise
      .map(options.sources, getPhoto)
      .each((photoBuffer, i) => {

        const img = new Canvas.Image();
        img.src = photoBuffer;
        ctx.drawImage(img, 0,0, options.imageWidth, options.imageHeight);
        ctx.drawImage(overlay, 0, 0, options.overlayWidth, options.overlayHeight);

      })
      .return(canvas);
  }
};
