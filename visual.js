Module.add( 'visual', () => {

let ImgCache = {};
Node.prototype.on = function(...args) {
	Node.prototype.addEventListener.call(this,...args);
	return this;
}

class Visual {
	constructor() {
		this.parent = null;
		this.x = 0;
		this.y = 0;
		this.layoutFn = null;
		this.elementLayoutFn = null;
	}
	get root() {
		return this.parent || this;
	}
	get width() {
	}
	get height() {
	}
	add(visual) {
		console.assert(false);
	}
	align() {
		if( !this.element ) return;
		let r = this.rect;
		this.element.style.left = r.x;
		this.element.style.top = r.y;
		this.element.style.width = r.width;
		this.element.style.height = r.height;
	}
	link(className,elementLayoutFn) {
		return this.root.addElement(this,className,elementLayoutFn);
	}
	on(eventId,fn) {
		return this.root.on(this.element,eventId,fn);
	}
	lay() {
		if( this.layoutFn ) {
			this.layoutFn(this);
		}
		if( this.element && !this.elementLayoutFn ) {
			this.align();
		}
		if( this.elementLayoutFn ) {
			this.elementLayoutFn(this);
		}
	}
	tick(dt) {
	}
	render() {
	}
}

Visual.Line = class extends Visual {
	constructor(color,thickness=1) {
		super();
		this.color = color;
		this.thickness = thickness;
		this.dash = [];
	}
	render() {
		var ctx = this.root.context;
		ctx.beginPath();
		ctx.setLineDash(this.dash);
		ctx.strokeStyle = this.color;
		ctx.lineWidth	= this.thickness;
		ctx.moveTo(this.x, this.y);
		ctx.lineTo(this.ex, this.ey);
		ctx.stroke();
		ctx.setLineDash([]);
		super.render();
	}
}


Visual.Sprite = class extends Visual {
	constructor(imageUrl) {
		super();
		this._image = null;
		this.image = imageUrl;
		this.scale = 1.0;
		this.xScale = null;
		this.yScale = null;
		this.xAnchor = 0.5;
		this.yAnchor = 0.5;
		this.margin = 0;
	}
	set image(url) {
		if( url === null ) return;
		if( !ImgCache[url] ) {
			ImgCache[url] = new Image();
			ImgCache[url].src = url;
			ImgCache[url].onload = () => ImgCache[url].loaded = true;
		}
		this._image = ImgCache[url];
	}
	get rect() {
		return {
			x: this.x-this.xAnchor*this.width-this.margin,
			y: this.y-this.yAnchor*this.height-this.margin,
			width: this.width+this.margin*2,
			height: this.height+this.margin*2
		}
	}
	get image() {
		return this._image;
	}
	get naturalWidth() {
		return this.loaded ? this.image.naturalWidth : 1.0;
	}
	get naturalHeight() {
		return this.loaded ? this.image.naturalHeight : 1.0;
	}
	get width() {
		return this.naturalWidth*(this.xScale ? this.xScale : this.scale);
	}
	get height() {
		return this.naturalHeight*(this.yScale ? this.yScale : this.scale);
	}
	scaleToWidth(w) {
		this.scale = w / this.naturalWidth;
	}
	scaleToHeight(h) {
		if( this.image.loaded ) {
			this.scale = h / this.naturalHeight;
		}
	}
	render() {
		if( this._image.loaded ) {
			this.root.context.drawImage(
				this.image,
				this.x-this.xAnchor*this.width,
				this.y-this.yAnchor*this.height,
				this.width,
				this.height
			);
		}
		super.render();
	}
}

Visual.Text = class extends Visual {
	constructor(color,text) {
		super();
		this.color = color;
		this.text = text;
		this.xAnchor = 0.5;
		this.yAnchor = 0.3;
		this.textWidth = null
		this.textHeight = null;
	}
	setText(text) {
		this.text = text;
	}
	textWidthAt(px) {
		this.root.context.font = ''+px+'px Arial';
		return this.root.context.measureText(this.text).width;
	}
	render() {
		console.assert( this.textWidth!==null || this.textHeight!==null );
		let fontSize = Math.floor( this.textHeight ? this.textHeight : this.textWidthAt(100)/100*this.textWidth );
		this.root.context.fillStyle = this.color;
		this.root.context.strokeStyle = this.color;
		this.root.context.font = ''+fontSize+'px Arial';
		let w = this.textWidthAt(fontSize);
		this.root.context.fillText( this.text, this.x-this.xAnchor*w, this.y+this.yAnchor*fontSize );
		super.render();
	}
}

Visual.Arc = class extends Visual {
	constructor(color,fill,inner,outer,start,end,thickness=1) {
		super();
		this.color  = color || 'white';
		this.fill	= fill || 'grey';
		this.outer = outer;
		this.inner  = inner;
		this.start  = start;
		this.end    = end;
		this.thickness = thickness;
		console.log(this);
	}
	render() {
		let pt = (radians,dist) => [ this.x+Math.cos(radians)*dist, this.y+Math.sin(radians)*dist ];

		let ctx = this.root.context;
		ctx.fillStyle   = this.fill;
		ctx.strokeStyle = this.color;
		ctx.lineWidth	= this.thickness;

		console.assert( this.start <= this.end );

		ctx.beginPath();
		ctx.moveTo( ...pt(this.start,this.inner) );
		ctx.lineTo( ...pt(this.start,this.outer) );
		ctx.arc( this.x, this.y, this.outer, this.start, this.end );
		ctx.lineTo( ...pt(this.end,this.inner) );
		ctx.arc( this.x, this.y, this.inner, this.end, this.start, true );
		ctx.fill();
		ctx.stroke();
	}
}


Visual.Canvas = class {
	constructor(rootDiv,makeComponentFn) {
		window.addEventListener('resize', () => {
			this.sizeToDiv();
		});

		this.data		= null;
		this.layout		= null;
		this.element	= {};
		this.visual		= {};

		this.canvas  = document.createElement("canvas");                 // Create a <li> node
		this.canvas.style.position = 'absolute';
		this.context = this.canvas.getContext('2d');

		this.div = document.getElementById(rootDiv);

		this.div.appendChild(this.canvas);

		this.overlay = document.createElement("div");
		this.overlay.style.position = 'absolute';
		this.overlay.style.zIndex = (this.canvas.style.zIndex||0)+1;

		this.div.insertBefore(this.overlay,this.canvas)

		makeComponentFn(this);

		this.sizeToDiv();
	}
	get pixelRatio() {
		var ctx = document.createElement('canvas').getContext('2d');
		let dpr = window.devicePixelRatio || 1;
		let bsr = ctx.webkitBackingStorePixelRatio ||
			ctx.mozBackingStorePixelRatio ||
			ctx.msBackingStorePixelRatio ||
			ctx.oBackingStorePixelRatio ||
			ctx.backingStorePixelRatio ||
			1;
		return dpr / bsr;
	}
	sizeToDiv() {
		let [w, h] = [this.div.clientWidth, this.div.clientHeight];
		this.canvas.width = w * this.pixelRatio;
		this.canvas.height = h * this.pixelRatio;
		this.canvas.style.height = h+'px';
		this.canvas.style.width  = w+'px';

		this.overlay.style.width = this.canvas.style.width;
		this.overlay.style.height = this.canvas.style.height;

		// Throw an incredibly weird wrinkle, this.context is wrong unless you gge the context yourself by hand.
	    this.canvas.getContext('2d').scale(this.pixelRatio, this.pixelRatio);
		this.lay();
	}
	get width() {
		return parseInt(this.canvas.style.width);
	}
	get height() {
		return parseInt(this.canvas.style.height);
	}
	addVisual(id,visual,layoutFn) {
		visual.id = id;
		visual.layoutFn = layoutFn
		this.visual[id] = visual;
		visual.parent = this;
		return visual;
	}
	addLayout(layout) {
		this.layout = layout;
	}
	addVisuals(visualHash) {
		Object.each( visualHash, (pair,id) => this.addVisual( id, pair[0], pair[1] ) );
	}
	addElements(elements) {
	}
	addData(data) {
		this.data = data;
	}
	on(element,eventId,fn) {
		return element.on( eventId, fn );
	}
	addElement(visual,className,elementLayoutFn) {
		let element = document.createElement("div");
		element.style.position = "absolute";
		element.classList.add(className);
		this.overlay.appendChild(element);
		this.element[visual.id] = element;
		visual.element   = element;
		visual.elementLayoutFn = elementLayoutFn;
		return element;
	}
	traverse(fn) {
		Object.each( this.visual, fn );
	}
	lay() {
		this.traverse( visual => visual.lay() );
	}
	tick(dt) {
		this.data.update();
		this.traverse( visual => visual.tick(dt) );
		this.lay();
	}
	render() {
		this.context.fillStyle = 'black';
		this.context.fillRect(0,0,this.width,this.height);
		this.traverse( visual => visual.render() );
	}
}

Visual.Data = class {
	constructor() {
	}
	update() {
	}
}

return {
	Visual: Visual
}

})
