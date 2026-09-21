let Settings = {
  light_height: 300,
  background_color: [229, 229, 229],
  substance_color: [50, 158, 168],
  specular_color: [128, 128, 128],
  shininess: 64,
  bump: 20,
  anisotropy: 0.8,
  feed: 0.042,
  kill: 0.06,
  diffusion_scale: 0.625
};

let width = window.innerWidth;
let height = window.innerHeight;
let actual_width = Math.round(width * window.devicePixelRatio);
let actual_height = Math.round(height * window.devicePixelRatio);
let simulation_width = Math.round(actual_width / 2.5);
let simulation_height = Math.round(actual_height / 2.5);
let scene = new THREE.Scene();
let camera = new THREE.Camera();
camera.position.z = 1;
let renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

let render_vertex = `
  void main()
  {
    gl_Position = vec4(position, 1.0);
  }
`;

let render_fragment = `
  uniform vec3 background_color;
  void main()
  {
    gl_FragColor = vec4(background_color, 1.0);
  }
`;

let background = new THREE.ShaderMaterial({
  vertexShader: render_vertex,
  fragmentShader: render_fragment,
  uniforms: {
    background_color: { value: new THREE.Vector3(0.9, 0.9, 0.9) }
  }
});
scene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), background));

function animate()
{
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
