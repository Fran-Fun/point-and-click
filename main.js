/*
    Author: Joe Anzalone
    Date: July 2015 (three.js r71)
*/

// MAIN

// Standard global variables
var container, scene, camera, renderer;
var clock = new THREE.Clock();

// Custom global variables
var mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();
var max;
var floor;
var backgroundScene;
var walkSpeed = 0.13;
var SCREEN_WIDTH;
var SCREEN_HEIGHT;
var viewPortWidth = 640;
var viewPortHeight = 480;
var container;

init();
animate();

// FUNCTIONS
function init() {
    // SCENE
    scene = new THREE.Scene();
    backgroundScene = new THREE.Scene();

    // CAMERA

    var near = 0,
        far = 500;

    orthoGraphicCamera = new THREE.OrthographicCamera(
        viewPortWidth / -2,
        viewPortWidth / 2,
        viewPortHeight / 2,
        viewPortHeight / - 2,
        near,
        far
    );
    camera = orthoGraphicCamera;

    scene.add(camera);
    camera.position.set(0, viewPortHeight/2, 400);
    camera.lookAt(scene.position);

    // RENDERER
    if (Detector.webgl) {
        renderer = new THREE.WebGLRenderer( {antialias: false} );
    } else {
        renderer = new THREE.CanvasRenderer();
    }

    renderer.setSize(viewPortWidth, viewPortHeight);
    container = document.getElementById('game-wrapper');
    container.appendChild(renderer.domElement);
    renderer.autoClear = false;

    // EVENTS
    window.addEventListener('mousedown', onMouseClick, false);
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    var resizer = new THREEx.WindowResize(renderer, camera, function(){
        if (SCREEN_WIDTH / SCREEN_HEIGHT > viewPortWidth/viewPortHeight) {
            var width = SCREEN_HEIGHT * (viewPortWidth / viewPortHeight);
            var height = SCREEN_HEIGHT;
        } else {
            var width = SCREEN_WIDTH;
            var height = SCREEN_WIDTH * (viewPortHeight / viewPortWidth);
        }

        return {width: width, height: height};
    });
    resizer.trigger();

    // FLOOR
    var floorGeometry = new THREE.PlaneBufferGeometry(1000, 1000, 10, 10);

    var floorMaterial = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);

    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    scene.fog = new THREE.FogExp2( 0x9999ff, 0.00025 );

    ////////////
    // CUSTOM //
    ////////////

    var backgroundMaterial = new THREE.SpriteMaterial({
        map: THREE.ImageUtils.loadTexture('images/background-street.png')
    });
    var background = new THREE.Sprite(backgroundMaterial);

    background.scale.set(480 * 2.4, 200 * 2.4, 1);
    backgroundScene.add(background);

    // 344 x 56
    // 8 frames: each 43x56
    var maxWalkFrontTexture = THREE.ImageUtils.loadTexture('images/max-walk-front.png');
    // 34x52
    var maxStandFrontTexture = THREE.ImageUtils.loadTexture('images/max-stand-front.png');

    // 320 x 55
    // 8 frames: each 40x55
    var maxWalkBackTexture = THREE.ImageUtils.loadTexture('images/max-walk-back.png');
    // 31x52
    var maxStandBackTexture = THREE.ImageUtils.loadTexture('images/max-stand-back.png');

    // 408x54
    // 8 frames: each 51x54
    var maxWalkRightTexture = THREE.ImageUtils.loadTexture('images/max-walk-right.png');
    // 37x52
    var maxStandRightTexture = THREE.ImageUtils.loadTexture('images/max-stand-right.png');

    var maxMaterial = new THREE.SpriteMaterial();
    maxSprite = new THREE.Sprite(maxMaterial);
    maxAnimator = new TextureAnimator(maxSprite, {
        walkFront: {texture: maxWalkFrontTexture, width: 43, height: 56, tilesHoriz: 8, tilesVert: 1, numTiles: 8, duration: 120},
        standFront: {texture: maxStandFrontTexture, width: 34, height: 52},
        walkBack: {texture: maxWalkBackTexture, width: 40, height: 55, tilesHoriz: 8, tilesVert: 1, numTiles: 8, duration: 120},
        standBack: {texture: maxStandBackTexture, width: 31, height: 52},
        walkRight: {texture: maxWalkRightTexture, width: 51, height: 54, tilesHoriz: 8, tilesVert: 1, numTiles: 8, duration: 120},
        standRight: {texture: maxStandRightTexture, width: 37, height: 52},
        walkLeft: {texture: maxWalkRightTexture, width: -51, height: 54, tilesHoriz: 8, tilesVert: 1, numTiles: 8, duration: 120},
        standLeft: {texture: maxStandRightTexture, width: -37, height: 52}
    });

    max = new THREE.Object3D();
    max.animator = maxAnimator;
    max.sprite = maxSprite;
    maxAnimator.stop('standFront');
    scene.add(max);
    max.position.set(63, 0, 172);
    max.add(maxSprite);
    placeOnFloor(maxSprite);
    scene.add(max);
}

function TextureAnimator(sprite, configs) {
    var sprite;
    stopped = false;
    this.sprite = sprite;
    this.configs = configs;

    this.getConfig = function(configStr) {
        return configs[configStr];
    }

    this.animate = function (configStr) {
        config = this.getConfig(configStr);
        if (config == this.currentConfig) {
            return;
        }
        this.currentConfig = config;
        sprite.material.map = config.texture;
        sprite.scale.set(config.width, config.height, 1);

        // note: texture passed by reference, will be updated by the update function.
        this.tilesHorizontal = config.tilesHoriz;
        this.tilesVertical = config.tilesVert;
        // how many images does this spritesheet contain?
        // usually equals tilesHoriz * tilesVert, but not necessarily,
        // if there at blank tiles at the bottom of the spritesheet.
        this.numberOfTiles = config.numTiles;
        config.texture.wrapS = config.texture.wrapT = THREE.RepeatWrapping;
        config.texture.repeat.set( 1 / this.tilesHorizontal, 1 / this.tilesVertical );

        // how long should each image be displayed?
        this.tileDisplayDuration = config.duration;

        // how long has the current image been displayed?
        this.currentDisplayTime = 0;

        // which image is currently being displayed?
        this.currentTile = 0;
        this.stopped = false;
    }

    this.stop = function(frameName) {
        this.stopped = true;
        var frame = this.getConfig(frameName);
        this.currentConfig = frame;
        sprite.material.map = frame.texture;
        sprite.scale.set(frame.width, frame.height, 1);
    }

    this.update = function(milliSec) {
        if (typeof config == undefined || this.stopped) {
            return;
        }

        this.currentDisplayTime += milliSec;
        while (this.currentDisplayTime > this.tileDisplayDuration)
        {
            this.currentDisplayTime -= this.tileDisplayDuration;
            this.currentTile++;
            if (this.currentTile == this.numberOfTiles)
                this.currentTile = 0;
            var currentColumn = this.currentTile % this.tilesHorizontal;
            config.texture.offset.x = currentColumn / this.tilesHorizontal;
            var currentRow = Math.floor(this.currentTile / this.tilesHorizontal);
            config.texture.offset.y = currentRow / this.tilesVertical;
        }
    };
}

function placeOnFloor(object) {
    object.position.y = object.scale.y / 2;
}

function panObject(object, target, options) {
    var from = object.position;

    target.x = target.x ? target.x : object.position.x;
    target.y = target.y ? target.y : object.position.y;
    target.z = target.z ? target.z : object.position.z;

    if (target.x < options.constrain.x[0]) {
        target = options.constrain.x[0];
    }

    if (target.x > options.constrain.x[1]) {
        target = options.constrain.x[1];
    }

    // Kind of weird that it has to be done this way but ¯\_(ツ)_/¯
    // https://github.com/tweenjs/tween.js/issues/189#issuecomment-83422621
    var time = from.distanceTo(target) / options.speed;

    object.tween = new TWEEN.Tween(from).to(target, time);

    object.tween.start();
}

function setObjectScale(object) {
    var bigness = (object.position.z + 1000) / 600;

    object.scale.x = bigness;
    object.scale.y = bigness;
}

function moveMax(target) {
    // This method of detecting a character's orientation
    // is brittle since it will break if you move the camera :\
    var from = max.position;
    var deltaX = Math.abs(from.x - target.x);
    var deltaZ = Math.abs(from.z - target.z);
    var stopFrame;
    var direction;

    // X gets higher as you go right
    // Z gets higher as you go down
    if (deltaX > deltaZ) {
        // Left/right changed more
        if (from.x > target.x) {
            max.animator.animate('walkLeft');
            stopFrame = 'standLeft';
        } else {
            max.animator.animate('walkRight');
            stopFrame = 'standRight';
        }
    } else {
        // Up/down changed more
        if (from.z < target.z) {
            max.animator.animate('walkFront');
            stopFrame = 'standFront';
        } else {
            max.animator.animate('walkBack');
            stopFrame = 'standBack';
        }
    }

    // Kind of weird that it has to be done this way but ¯\_(ツ)_/¯
    // https://github.com/tweenjs/tween.js/issues/189#issuecomment-83422621
    var time = from.distanceTo(target) / walkSpeed;

    if (max.tween) {
        max.tween.stop();
    }

    max.tween = new TWEEN.Tween(from).to(target, time);

    max.tween.onComplete(function() {
        max.animator.stop(stopFrame);
    });

    max.tween.start();
}

function onMouseClick(event) {

    function relMouseCoords(event, currentElement) {
        // http://stackoverflow.com/a/20027355
        var rect = currentElement.getBoundingClientRect(), // get absolute rect. of canvas
        x = event.clientX - rect.left,                     // adjust for x
        y = event.clientY - rect.top;                      // adjust for y

        return {x: x, y: y};
    }

    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    var mouse = relMouseCoords(event, renderer.domElement);
    mouse.x = (mouse.x / renderer.domElement.width) * 2 - 1;
    mouse.y = - (mouse.y / renderer.domElement.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects([floor]);

    if (intersects.length > 0) {
        var coord = intersects[0].point;
        var target = {x: coord.x, y: max.position.y, z: coord.z};
        this.moveMax(target);
    }
}

function onWindowResize() {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
}

function cameraUpdate() {
    if (Math.abs(max.position.x - camera.position.x) > 100) {
        var target = {x: max.position.x};
        panObject(camera, target, {
            constrain: {x: [-256, 256]},
            speed: walkSpeed
        });
    }
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    render();
    update();
}

function update() {
    var delta = clock.getDelta();
    maxAnimator.update(1000 * delta);
    cameraUpdate();
    setObjectScale(max);
}

function render() {
    renderer.render(backgroundScene, camera);
    renderer.render(scene, camera);
}
