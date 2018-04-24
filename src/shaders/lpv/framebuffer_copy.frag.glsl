#version 300 es
precision highp float;

in vec2 v_tex_coord;

uniform sampler2D u_texture_red;
uniform sampler2D u_texture_green;
uniform sampler2D u_texture_blue;

layout(location = 0) out vec4 o_red;
layout(location = 1) out vec4 o_green;
layout(location = 2) out vec4 o_blue;

void main()
{
	o_red = texture(u_texture_red, v_tex_coord);
	o_green = texture(u_texture_green, v_tex_coord);
	o_blue = texture(u_texture_blue, v_tex_coord);
}
