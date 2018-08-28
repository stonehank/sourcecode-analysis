/**
 * @author mrdoob / http://mrdoob.com/
 */

var Stats = function () {

	var mode = 0;

	// 创建dom
	var container = document.createElement( 'div' );
	container.style.cssText = 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000';
	container.addEventListener( 'click', function ( event ) {

		event.preventDefault();
		// 循环显示面板
		showPanel( ++ mode % container.children.length );

	}, false );

	// 加入dom
	function addPanel( panel ) {

		container.appendChild( panel.dom );
		return panel;

	}

	// 一个简单的block none切换
	function showPanel( id ) {

		for ( var i = 0; i < container.children.length; i ++ ) {

			container.children[ i ].style.display = i === id ? 'block' : 'none';

		}

		mode = id;

	}

	// 记录初始时间
	var beginTime = ( performance || Date ).now(), prevTime = beginTime, frames = 0;

	// 分别加入每一个面板
	var fpsPanel = addPanel( new Stats.Panel( 'FPS', '#0ff', '#002' ) );
	var msPanel = addPanel( new Stats.Panel( 'MS', '#0f0', '#020' ) );

	if ( self.performance && self.performance.memory ) {

		var memPanel = addPanel( new Stats.Panel( 'MB', '#f08', '#201' ) );

	}

	// 默认显示第一个
	showPanel( 0 );

	return {

		REVISION: 16,

		dom: container,

		addPanel: addPanel,
		showPanel: showPanel,

		// 通过beginTime自定义开始时间
		begin: function () {

			beginTime = ( performance || Date ).now();

		},

		end: function () {

			frames ++;

			var time = ( performance || Date ).now();

      // 对每一帧的时间更新
			msPanel.update( time - beginTime, 200 );

			// 当时间消耗超过1000(也就是每秒更新)
			if ( time >= prevTime + 1000 ) {
				// 对fps更新 frames为执行的帧数，time - prevTime为消耗的时间
				// 根据当前 每一帧消耗的时间计算每1000毫秒执行多少帧
				fpsPanel.update( ( frames * 1000 ) / ( time - prevTime ), 100 );

				prevTime = time;
				frames = 0;

				// 对内存更新
				if ( memPanel ) {
					var memory = performance.memory;
					// 以MB 为单位
					memPanel.update( memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576 );

				}

			}

			return time;

		},

		// 通过update调用
		update: function () {

			beginTime = this.end();

		},

		// Backwards Compatibility

		domElement: container,
		setMode: showPanel

	};

};

Stats.Panel = function ( name, fg, bg ) {

	var min = Infinity, max = 0, round = Math.round;
	// 设备像素比，越大越清晰
	var PR = round( window.devicePixelRatio || 1 );

	// 设定各项宽和高
	var WIDTH = 80 * PR, HEIGHT = 48 * PR,
			TEXT_X = 3 * PR, TEXT_Y = 2 * PR,
			GRAPH_X = 3 * PR, GRAPH_Y = 15 * PR,
			GRAPH_WIDTH = 74 * PR, GRAPH_HEIGHT = 30 * PR;

	// 创建canvas
	var canvas = document.createElement( 'canvas' );
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	canvas.style.cssText = 'width:80px;height:48px';

	var context = canvas.getContext( '2d' );
	context.font = 'bold ' + ( 9 * PR ) + 'px Helvetica,Arial,sans-serif';
	context.textBaseline = 'top';

  // 设置整个面板
	context.fillStyle = bg;
	context.fillRect( 0, 0, WIDTH, HEIGHT );


  // 设置柱状条面板
	context.fillStyle = fg;
	context.fillText( name, TEXT_X, TEXT_Y );
	context.fillRect( GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT );

  // 设置背景透明面板
	context.fillStyle = bg;
	context.globalAlpha = 0.9;
	context.fillRect( GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT );

	return {

		dom: canvas,

		update: function ( value, maxValue ) {
			// 记录数据最大值和最小值
			min = Math.min( min, value );
			max = Math.max( max, value );

			context.fillStyle = bg;
			// 全局透明度为1
			context.globalAlpha = 1;
      // 设置字体面板
			context.fillRect( 0, 0, WIDTH, GRAPH_Y );
			context.fillStyle = fg;
      // 数据显示 例如： 60 FPS(0-60)
			context.fillText( round( value ) + ' ' + name + ' (' + round( min ) + '-' + round( max ) + ')', TEXT_X, TEXT_Y );

      // 在字体面板内渲染数据并且裁剪左边1px
			context.drawImage( canvas, GRAPH_X + PR, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT, GRAPH_X, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT );

      // 填充柱状条，宽度为1
			context.fillRect( GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT );

      // 再次使用半透明bg覆盖 当前数据/max 剩余的部分
			context.fillStyle = bg;
			context.globalAlpha = 0.9;
			context.fillRect( GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, round( ( 1 - ( value / maxValue ) ) * GRAPH_HEIGHT ) );

		}

	};

};

export { Stats as default };
