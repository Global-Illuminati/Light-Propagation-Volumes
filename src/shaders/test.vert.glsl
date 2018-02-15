#version 300 es

layout(location = 0) in vec3 a_position;
out vec3 v_color;

void main()
{
	v_color = a_position / vec3(10.0);
	gl_Position = vec4(a_position, 1.0);
}
