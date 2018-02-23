
// This is an adaptation from the book Physically Based Rendering from Theory to implementation 
// to be on the safe side the copyright notice is included. However all code here is rewritten based 
// on the ideas presented in the book
// So the copyright notice probably doesn't need to be included... idk.
// either way here it is:
// Daniel 22 Feb 2018


/*
 * Copyright(c) 1998 - 2015, Matt Pharr, Greg Humphreys, and Wenzel Jakob.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met :
 *
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


// NOTE:
// 
// We have no acceleration structures in place
// if this turns out to be a hot spot 
// we should probably change how we voxelize the scene 
// and also keep track of which tris are in which voxels and utilize that in the ray tracing
// or even build an octtree directly where the voxels are the lowest level. Same idea.
//
// However until we confirmed that this is indeed the hotspot we'll hold off on that.
// it's quite a bit of work after all. 
// Daniel 22 Feb 2018


struct Ray {
	vec3 origin, dir;
};

struct InternalRay {
	vec3 origin;
	// the direction is implicitly encoded in shear + permutation
	// after shear and permutation is applied the dir will be (0,0,1)
	// so the dir doesn't need to be accessed.
	// shear applied make ray.dir = (0,0,1)
	vec3 shear;
	// permuation so that ray.dir.z is larger than x,y 
	ivec3 permutation;

	float t_max;
};

int max_dimension(vec3 v) {
	if (v.x() > v.y()) {
		if (v.x() > v.z()) return 0;
		else return 2;
	} else {
		if (v.y() > v.z())return 1;
		else return 2;
	}
}

vec3 permute(vec3 v, ivec3 permutation) {
	return vec3(v[permutation.x()], v[permutation.y()], v[permutation.z()]);
}

InternalRay make_internal_ray(Ray ray) {
	ivec3 permutation;
	// permute so that z is the largest dimension
	permutation.z() = max_dimension(ray.dir);
	permutation.x() = permutation.z() + 1; if (permutation.x() == 3) permutation.x() = 0;
	permutation.y() = permutation.x() + 1; if (permutation.y() == 3) permutation.y() = 0;
	
	ray.dir = permute(ray.dir, permutation);
	
	// shear so that ray.dir -> (0,0,1)
	vec3 shear(
		-ray.dir.x() / ray.dir.z(),
		-ray.dir.y() / ray.dir.z(),
		1.0f / ray.dir.z());
	
	return {ray.origin,shear, permutation, FLT_MAX};
}

struct HitInfo {
	vec3 pos;
	float t;
};

bool intersect(InternalRay &ray, const Triangle &t, HitInfo *hit_info) {
	vec3 a = t.a - ray.origin;
	vec3 b = t.b - ray.origin;
	vec3 c = t.c - ray.origin;

	//permute the triangle in accordence with the ray. 
	permute(a, ray.permutation);
	permute(b, ray.permutation);
	permute(c, ray.permutation);

	a.x() += ray.shear.x() * a.z();
	a.y() += ray.shear.y() * a.z();

	b.x() += ray.shear.x() * b.z();
	b.y() += ray.shear.y() * b.z();

	c.x() += ray.shear.x() * c.z();
	c.y() += ray.shear.y() * c.z();
	// hold off with shearing the z coord for as long as possible (early outs). 

	// now all we need to do is compute barycentric coordinates and see if the origin is within the triangle
	// the following does that but with a few early outs... Perf?
	float e0 = b.x() * c.y() - b.y() * c.x();
	float e1 = c.x() * a.y() - c.y() * a.x();
	float e2 = a.x() * b.y() - a.y() * b.x();

	if (e0 == 0 || e1 == 0 || e2 == 0) {
		assert(false && "can't deside if inside of triangle, should recompute edgefunctions with doubles");
	}

	// if signs differ we're outside of the tri!
	if ((e0 < 0 || e1 < 0 || e2 < 0) && (e0 > 0 || e1 > 0 || e2 > 0)) return false;
	
	// if we hit the triangle edge on we report no hit.
	float det = e0 + e1 + e2;
	if (det == 0) return false;

	// Now apply the shear to z coord
	a.z() *= ray.shear.z();
	b.z() *= ray.shear.z();
	c.z() *= ray.shear.z();

	float t_scaled = e0 * a.z() + e1 * b.z() + e2 * c.z();
	
	// check that the ray is inside of our range ie. that t>= 0 && t < t_max
	// done before div with det cause fp div is slow.
	if (det < 0 && (t_scaled >= 0 || t_scaled < ray.t_max*det)) return false;
	else if (det > 0 && (t_scaled <= 0 || t_scaled > ray.t_max*det)) return false;

	// finally compute barycentric coords
	float inv_det = 1.0f / det;
	float b0 = e0 * inv_det;
	float b1 = e1 * inv_det;
	float b2 = e2 * inv_det;

	// set info
	hit_info->t = t_scaled * inv_det;
	hit_info->pos = t.a*b0 + t.b*b1 + t.c*b2;
	return true;
}

int find_closest_tri(Ray ray, Mesh mesh, vec3 *_out_hit = 0)
{
	int closest_tri = -1;
	vec3 hit;
	InternalRay &i_ray = make_internal_ray(ray);
	// find closest intersection of a and the mesh
	for (int tri_index = 0; tri_index < mesh.num_indices / 3; tri_index++) {
		int ia = mesh.indices[tri_index * 3 + 0];
		int ib = mesh.indices[tri_index * 3 + 1];
		int ic = mesh.indices[tri_index * 3 + 2];

		Triangle t =
		{
			mesh.verts[ia],
			mesh.verts[ib],
			mesh.verts[ic]
		};

		HitInfo hit_info;
		if (intersect(i_ray, t, &hit_info)) {
			// feels bad to put this in the intersect method. But we will probably always do this so donno
			i_ray.t_max = max(i_ray.t_max, hit_info.t);
			
			closest_tri = tri_index;
			hit = hit_info.pos;
		}

	}
	if (_out_hit) *_out_hit = hit;
	return closest_tri;
}

bool see_same_point(Ray a, vec3 p, Mesh mesh, vec3 *psi_dir) {

	vec3 hit;
	int closest_tri_a = find_closest_tri(a, mesh, &hit);
	Ray b = { p, hit - b.origin }; // note dir does not have to be normalized!
	int closest_tri_b = find_closest_tri(b, mesh);

	*psi_dir = b.dir;
	// @Robustness
	// this has probably got some problems if we hit the edge of a tri
	// and numerical errors make one ray hit one tri and the other the other.
	// maybe we should compare world space position but that also has its own set of problems
	// just comparing triangles is quite nice because it allows for large numerical errors 
	// since we know that if we hit the right triangle the position is also the same, down to numerial errors.
	// by definition of the second ray.
	// Daniel 22 Feb 2018
	return (closest_tri_b == closest_tri_a);
}


// @NOTE
// further down the line we'll also need uvs and textures..
// otherwise we can't encode color transfer...






