#version 300 es
precision highp float;

layout(location = 0) out vec4 o_color_map;
layout(location = 1) out vec3 o_position_map;
layout(location = 2) out vec3 o_normal_map;

uniform sampler2D u_diffuse_map;
uniform vec3 u_light_direction;
uniform vec3 u_light_color;

in mat4 o_normal_matrix;
in vec4 o_world_space_position;
in vec3 o_normal;
in vec2 o_tex_coord;

#include <common.glsl>

void main()
{
	vec3 diffuse = texture(u_diffuse_map, o_tex_coord).rgb;
	vec3 light_direction = normalize(u_light_direction);
	vec3 world_normal = normalize(o_normal_matrix * vec4(o_normal, 0.0)).xyz;
	//TODO: fix position and normal to work with normal mapping

	vec4 flux = vec4(u_light_color * diffuse * saturate(dot(-light_direction, world_normal)), 1.0);

	o_color_map = flux;
	o_position_map = o_world_space_position.xyz;
	o_normal_map = world_normal;
}
