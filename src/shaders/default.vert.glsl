#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_tex_coord;

layout(std140) uniform SceneUniforms {
	vec4 u_ambient_color;
	//
	vec4 u_directional_light_color;
	vec4 u_directional_light_direction;
};

uniform mat4 u_world_from_local;
uniform mat4 u_view_from_world;
uniform mat4 u_projection_from_view;

out vec3 v_position;
out vec3 v_normal;
out vec2 v_tex_coord;

void main()
{
	mat4 view_from_local = u_view_from_world * u_world_from_local;

	// NOTE: normal only works for uniformly scaled objects!
	vec4 world_space_position = u_world_from_local * vec4(a_position, 1.0);
	vec4 world_space_normal   = u_world_from_local * vec4(a_normal, 0.0);

	v_position  = vec3(world_space_position);
	v_normal    = vec3(world_space_normal);
	v_tex_coord = a_tex_coord;

	gl_Position = u_projection_from_view * u_view_from_world * world_space_position;

}
