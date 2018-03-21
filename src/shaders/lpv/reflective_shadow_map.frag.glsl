#version 300 es
precision highp float;

layout(location = 0) out vec4 o_color_map;
layout(location = 1) out vec4 o_position_map;
layout(location = 2) out vec4 o_normal_map;

uniform sampler2D u_diffuse_map;
uniform vec3 u_light_direction;
uniform vec3 u_light_color;

in mat4 v_normal_matrix;
in vec4 v_world_space_position;
in vec3 v_normal;
in vec2 v_tex_coord;

#include <common.glsl>

//TODO: double check flux calculation
#define USING_DIR_LIGHT

void main()
{
	vec3 diffuse = texture(u_diffuse_map, v_tex_coord).rgb;
	vec3 light_direction = normalize(u_light_direction);
	vec3 world_normal = u_light_color * normalize(v_normal_matrix * vec4(v_normal, 0.0)).xyz;
	float light_falloff = saturate(dot(-light_direction, world_normal));

	#ifdef USING_DIR_LIGHT
		vec4 flux = vec4((u_light_color * diffuse), 1.0);
	#else
		vec4 flux = vec4(u_light_color * diffuse * light_falloff, 1.0);
	#endif
	
	o_color_map = flux;
	o_position_map = v_world_space_position;
	o_normal_map = vec4(world_normal, 1.0);
}
