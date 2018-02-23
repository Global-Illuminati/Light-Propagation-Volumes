
#define RHO_PROBES 7.0f

#pragma warning(disable:4996)
#include "stdafx.h"
#include "string.h"


#include "thekla_atlas.h"
using namespace Thekla;

#include <stdio.h>
#include <assert.h>
#define TINYOBJ_LOADER_C_IMPLEMENTATION
#include "tinyobj_loader_c.h"
#include "stdint.h"
#include "math.h"

//#define eigen_assert(x) do{if(!(x)){printf(#x);__debugbreak();}}while(0)
#include "Eigen\Dense"
typedef Eigen::Vector2f vec2;
typedef Eigen::Vector3f vec3;
typedef Eigen::Vector2i ivec2;
typedef Eigen::Vector3i ivec3;



const char *get_file_data(size_t *data_len, const char *file_path) {
	FILE *file = fopen(file_path, "rb");
	if (!file) return NULL;

	fseek(file, 0, SEEK_END);
	size_t file_size = ftell(file);
	rewind(file);
	char *data = (char *)malloc(file_size+1);
	data[file_size] = '\0';
	if (data) {
		fread(data, 1, file_size, file);
		*data_len = file_size;
	}
	fclose(file);
	return data;
}

int min(int a, int b) {
	return a < b ? a : b;
}
int max(int a, int b) {
	return a > b ? a : b;
}

float min(float a, float b) {
	return a < b ? a : b;
}
float max(float a, float b) {
	return a > b ? a : b;
}

// simple write rutine for OBJs, supports the baaare minimum.
// and of course two uvs ;)

//also fucks up if on vert has multiple uvs... but that shouldn't be super common anyway, albeit obviously allowed in the format..
void write_obj(tinyobj_attrib_t attr, tinyobj_shape_t *shapes, size_t num_shapes, Atlas_Output_Mesh *light_map_mesh, const char *output_file_name) {
	FILE *f = fopen(output_file_name, "w");
	fprintf(f, "# OBJ (ish) File with two set of uvs, vt & vt2\n");
	fprintf(f, "# Regenerated as part of precomputation chain in Global Illuminati\n");
	fprintf(f, "# Yes it's horrible to create a slight modification to an existing file format\n");
	fprintf(f, "# I should fix this up at some point and export using a better format that actually supports multiple uvs...\n");
	fprintf(f, "# // Daniel\n");

	for (int i = 0; i < attr.num_vertices; i++) {
		float a = attr.vertices[i * 3 + 0];
		float b = attr.vertices[i * 3 + 1];
		float c = attr.vertices[i * 3 + 2];

		fprintf(f, "v %f %f %f\n", a, b, c);
	}

	for (int i = 0; i < attr.num_texcoords; i++) {
		float a = attr.texcoords[i * 2 + 0];
		float b = attr.texcoords[i * 2 + 1];

		fprintf(f, "vt %f %f\n", a, b);
	}

	// light map uvs!
	for (int i = 0; i < light_map_mesh->vertex_count; i++) {
		float a = light_map_mesh->vertex_array[i].uv[0];
		float b = light_map_mesh->vertex_array[i].uv[1];
		fprintf(f, "vt2 %f %f\n", a, b);
	}


	struct vertex_info {
		int uv_index;
		int shape_index;
	};
	vertex_info *vertex_info_from_vert = (vertex_info *)malloc(sizeof(vertex_info)*attr.num_vertices);
	memset(vertex_info_from_vert, 0xff, sizeof(vertex_info)*attr.num_vertices);


	// works as long as only single uv per vertex. which should be the norm
	// but multipe is certainly allowed according to spec so yeah...

	for (int shape_idx = 0; shape_idx < num_shapes; shape_idx++) {
		tinyobj_shape_t shape = shapes[shape_idx];
		for (int i = 0; i < shape.length * 3; i++) {
			auto indices = attr.faces[(shapes[shape_idx].face_offset * 3 + i)];

			if (vertex_info_from_vert[indices.v_idx].uv_index == -1 || vertex_info_from_vert[indices.v_idx].uv_index == indices.vt_idx) {
				vertex_info_from_vert[indices.v_idx].uv_index = indices.vt_idx;
				vertex_info_from_vert[indices.v_idx].shape_index = shape_idx;
			} else {
				printf("OHH NOOOO! assumptions do not hold, multiple uvs per vert\n");
				printf("we need to split before generating light map!\n");
			}
		}
	}



	int shape_idx = -1;

	for (int face_idx = 0; face_idx < light_map_mesh->index_count / 3; face_idx++) {
		auto new_a_idx = light_map_mesh->index_array[face_idx * 3 + 0];
		auto new_b_idx = light_map_mesh->index_array[face_idx * 3 + 1];
		auto new_c_idx = light_map_mesh->index_array[face_idx * 3 + 2];

		auto a_idx = light_map_mesh->vertex_array[new_a_idx].xref;
		auto b_idx = light_map_mesh->vertex_array[new_b_idx].xref;
		auto c_idx = light_map_mesh->vertex_array[new_c_idx].xref;

		auto a_info = vertex_info_from_vert[a_idx];
		auto b_info = vertex_info_from_vert[b_idx];
		auto c_info = vertex_info_from_vert[c_idx];

		if (a_info.shape_index != shape_idx) { // new shape need to output the name and material
			shape_idx = a_info.shape_index;
			tinyobj_shape_t shape = shapes[shape_idx];
			fprintf(f, "o %s\n", shape.name);
			fprintf(f, "usemtl %s\n", shape.material_name);
			fprintf(f, "s off\n"); // probably not needed.
		}

		fprintf(f, "f %d/%d//%d %d/%d//%d %d/%d//%d\n",
			a_idx + 1, a_info.uv_index + 1, new_a_idx,
			b_idx + 1, b_info.uv_index + 1, new_b_idx,
			c_idx + 1, c_info.uv_index + 1, new_c_idx);
	}
	fclose(f);
}
#include "voxelizer.hpp"
#include "probe_reducer.hpp"
#include "ray_tracer.hpp"
#include "google_spherical_harmonics\spherical_harmonics.h"

iAABB2 transform_to_pixel_space(AABB2 bounding_box, Atlas_Output_Mesh *mesh) {
	iAABB2 ret;
	ivec2 atlas_size = ivec2(mesh->atlas_width, mesh->atlas_height);
	ivec2 fl = floor2(bounding_box.min);
	ivec2 cl = ceil2(bounding_box.max);

	ret.min = fl.cwiseMax(0);
	ret.max = cl.cwiseMax(atlas_size);

	return ret;
}


vec2 get_pixel_center(ivec2 pixel) {
	return vec2(pixel.x()+0.5, pixel.y()+0.5);
}

vec3 compute_barycentric_coords(vec2 p, Triangle2 &tri) {
	vec2 v0 = tri.b - tri.a;
	vec2 v1 = tri.c - tri.a;
	vec2 v2 = p - tri.a;
	float inv_denom = 1.0f/(v0.x() * v1.y() - v1.x() * v0.y());
	float v = (v2.x() * v1.y() - v1.x() * v2.y()) * inv_denom;
	float w = (v0.x() * v2.y() - v2.x() * v0.y()) * inv_denom;
	float u = 1.0f - v - w;
	return vec3(u, v, w);
}

struct Receiver {
	vec3 pos;
	vec3 norm;
};

void compute_receiver_locations(Atlas_Output_Mesh *light_map_mesh, Mesh mesh, std::vector<Receiver> &receivers) {

	printf("computing receiver locations\n");
	static uint8_t pixel_is_processed[1024][1024];
	for (int face_idx = 0; face_idx < light_map_mesh->index_count / 3; face_idx++) {
		auto new_a_idx = light_map_mesh->index_array[face_idx * 3 + 0];
		auto new_b_idx = light_map_mesh->index_array[face_idx * 3 + 1];
		auto new_c_idx = light_map_mesh->index_array[face_idx * 3 + 2];
		
		int xref_a = light_map_mesh->vertex_array[new_a_idx].xref;
		int xref_b = light_map_mesh->vertex_array[new_b_idx].xref;
		int xref_c = light_map_mesh->vertex_array[new_c_idx].xref;

		vec3 vert_a = mesh.verts[xref_a];
		vec3 vert_b = mesh.verts[xref_b];
		vec3 vert_c = mesh.verts[xref_c];

		vec3 norm_a = mesh.normals[xref_a];
		vec3 norm_b = mesh.normals[xref_b];
		vec3 norm_c = mesh.normals[xref_c];



		vec2 uv_a = Eigen::Map<vec2>(light_map_mesh->vertex_array[new_a_idx].uv);
		vec2 uv_b = Eigen::Map<vec2>(light_map_mesh->vertex_array[new_b_idx].uv);
		vec2 uv_c = Eigen::Map<vec2>(light_map_mesh->vertex_array[new_c_idx].uv);

		Triangle2 uv_tri = { uv_a,uv_b,uv_c};

		iAABB2 pixel_bounds = transform_to_pixel_space(aabb_from_triangle(uv_tri),light_map_mesh);
		ivec2 min = pixel_bounds.min;
		ivec2 max = pixel_bounds.max;
		
		for (int x = min.x(); x < max.x(); x++) for (int y = min.y(); y < max.y(); y++) {
			if (pixel_is_processed[x][y])continue;
			ivec2 pixel = ivec2(x, y);
			vec3 baryc = compute_barycentric_coords(get_pixel_center(pixel), uv_tri);
			if (baryc.x()>0 && baryc.z()>0 && baryc.z()>0) {
				pixel_is_processed[x][y] = true;
				vec3 pos = vert_a * baryc.x() + vert_b * baryc.y() + vert_c * baryc.z();
				vec3 norm = norm_a * baryc.x() + norm_b * baryc.y() + norm_c * baryc.z();
				receivers.push_back({ pos,norm });
			}
		}
	}
	printf("got %d receivers\n",receivers.size());
}

void generate_normals(Mesh *mesh) {

	mesh->normals = (vec3 *)calloc(mesh->num_verts, sizeof(vec3));

	for (int i = 0; i < mesh->num_indices / 3; i++) {
		int ia = mesh->indices[i * 3 + 0];
		int ib = mesh->indices[i * 3 + 1];
		int ic = mesh->indices[i * 3 + 2];

		vec3 a = mesh->verts[ia];
		vec3 b = mesh->verts[ib];
		vec3 c = mesh->verts[ic];

		vec3 n = (b - a).cross(c - a);

		mesh->normals[ia] += n;
		mesh->normals[ib] += n;
		mesh->normals[ic] += n;
	}

	for (int i = 0; i < mesh->num_verts; i++) {
		mesh->normals[i].normalize();
	}

}



// @NOTE: tinyobj loader is modified to avoid reading mtl file 
// because: hashtable implementation in the file was shit, ie. not at all working, (you can't link list quadratic probing dude...),
// and I didn't want to spend time fixing it 
// but in doing so we removed ability for object to have multiple materials
// this might be something that we want to fix eventually, but for now I just want to make it work 
// so just put the mtl on the shape, which should be fine as long as we don't have multple materials for a shape 
// which our blender exporter or three.js doesn't seem to support out of the box anyway. so mehhh...
// @NOTE might consider changing back to the c++ version and modify it so that it's not soooooo sloooow cause c version seems a bit unstable...
// or fix c-version cause I like the structure better... might be fine now though just maybe support multiple materials... maybe...
// Daniel, 11 Feb 2018 


#include "local_transport.hpp"



int main(int argc, char * argv[]) {
	

	tinyobj_attrib_t attr;
	tinyobj_shape_t* shapes = NULL;
	size_t num_shapes;
	tinyobj_material_t* materials = NULL;
	size_t num_materials;

	const char *obj_file_path = "../../assets/sponza/sponza.obj";
	//const char *obj_file_path = "A:/sphere_ico.obj";

	{
		size_t data_len = 0;
		const char* data = get_file_data(&data_len, obj_file_path);
		if (data == NULL) {
			printf("Error loading obj file.\n");
			return(0);
		}

		unsigned int flags = TINYOBJ_FLAG_TRIANGULATE;
		int ret = tinyobj_parse_obj(&attr, &shapes, &num_shapes, &materials,
			&num_materials, data, data_len+1, flags);
		if (ret != TINYOBJ_SUCCESS) {
			return 0;
		}

		printf("# of shapes_2    = %d\n", (int)num_shapes);
		free((void *)data);
	}


	// convert to theklas input format
	Atlas_Input_Face   *faces = (Atlas_Input_Face  *)malloc(sizeof(Atlas_Input_Face)*attr.num_face_num_verts);
	Atlas_Input_Vertex *verts = (Atlas_Input_Vertex*)malloc(sizeof(Atlas_Input_Vertex)*attr.num_vertices);

	for (int i = 0; i < attr.num_face_num_verts; i++) {
		faces[i].vertex_index[0] = attr.faces[i * 3 + 0].v_idx;
		faces[i].vertex_index[1] = attr.faces[i * 3 + 1].v_idx;
		faces[i].vertex_index[2] = attr.faces[i * 3 + 2].v_idx;
	}

	for (int i = 0; i < attr.num_vertices; i++) {
		verts[i] = {};
		verts[i].position[0] = attr.vertices[i * 3 + 0];
		verts[i].position[1] = attr.vertices[i * 3 + 1];
		verts[i].position[2] = attr.vertices[i * 3 + 2];
		verts[i].first_colocal = i;
	}


	{

		tinyobj_attrib_t attr_2;
		tinyobj_shape_t* shapes_2 = NULL;
		size_t num_shapes;
		tinyobj_material_t* materials_2 = NULL;
		size_t num_materials_2;


		size_t data_len = 0;
		const char* data = get_file_data(&data_len, obj_file_path);
		if (data == NULL) {
			printf("Error loading obj file.\n");
			return(0);
		}

		unsigned int flags = TINYOBJ_FLAG_TRIANGULATE;
		int ret = tinyobj_parse_obj(&attr_2, &shapes_2, &num_shapes, &materials_2,
			&num_materials_2, data, data_len, flags);
		if (ret != TINYOBJ_SUCCESS) {
			return 0;
		}
	}


	Atlas_Input_Mesh input_mesh;
	input_mesh.vertex_count = attr.num_vertices;
	input_mesh.vertex_array = verts;
	input_mesh.face_count = attr.num_face_num_verts;
	input_mesh.face_array = faces;

	Atlas_Output_Mesh *output_mesh =NULL;
#if 1
	{
		// Generate Atlas_Output_Mesh.
		Atlas_Options atlas_options;
		atlas_set_default_options(&atlas_options);


		// Avoid brute force packing, since it can be unusably slow in some situations.
		atlas_options.packer_options.witness.packing_quality = 1;
		atlas_options.packer_options.witness.conservative = false;
		atlas_options.packer_options.witness.texel_area = 3; // approx the size we want 

		atlas_options.charter_options.witness.max_chart_area = 100000;

	
		Atlas_Error error = Atlas_Error_Success;
		output_mesh = atlas_generate(&input_mesh, &atlas_options, &error);



		printf("Atlas mesh has %d verts\n", output_mesh->vertex_count);
		printf("Atlas mesh has %d triangles\n", output_mesh->index_count / 3);
		printf("Produced debug_packer_final.tga\n");

		printf("in:%d\n", attr.num_faces);
		printf("out:%d\n", output_mesh->index_count);

		write_obj(attr, shapes, num_shapes, output_mesh, "../../assets/sponza/sponza.obj_2xuv");
	}
#endif
	
	static VoxelScene data;
	Mesh m = {};
	{ // set up the mesh
		m.num_verts = input_mesh.vertex_count;
		m.num_indices = input_mesh.face_count * 3;
		m.verts = (vec3 *)attr.vertices;// dangerous assumes no padding in the struct

		int *indices = (int *)malloc(m.num_indices * sizeof(int));
		for (int i = 0; i < m.num_indices / 3; i++) {
			indices[i * 3 + 0] = input_mesh.face_array[i].vertex_index[0];
			indices[i * 3 + 1] = input_mesh.face_array[i].vertex_index[1];
			indices[i * 3 + 2] = input_mesh.face_array[i].vertex_index[2];
		}
		m.indices = indices;
		generate_normals(&m);
	}
	std::vector<vec3>probes;
	{//voxelize and generate probes
		voxelize_scene(m, &data);
		std::vector<ivec3>probe_voxels;
		flood_fill_voxel_scene(&data, probe_voxels);
		write_voxel_data(&data, "../voxels.dat");
		
		get_voxel_centers(probe_voxels, &data, probes);
		reduce_probes(probes, &data, RHO_PROBES);
		write_probe_data(probes, "../probes.dat");
		printf("Probes saved to ../probes.dat");
		
	}
	std::vector<Receiver>receivers;

	{ // generate receivers
		compute_receiver_locations(output_mesh, m, receivers);
	}

	{ // compute local transport
		compute_alpha(receivers, probes, m, RHO_PROBES);
	}

	


	// Free stuff
	atlas_free(output_mesh);
	free(faces);
	free(verts);
	tinyobj_attrib_free(&attr);
	tinyobj_shapes_free(shapes, num_shapes);
	tinyobj_materials_free(materials, num_materials);
	return 0;
}
